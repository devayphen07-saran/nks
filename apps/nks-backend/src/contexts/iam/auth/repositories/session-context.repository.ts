import { Injectable } from '@nestjs/common';
import { eq, and, isNull, gt, lt, or, sql, inArray, asc, desc, notInArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import type { UserSession, NewUserSession } from '../../../../core/database/schema/auth/user-session';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionContextRepository - Complex auth context queries and session lifecycle
 * Handles: session auth context, session limit enforcement, expired session cleanup
 * Does NOT handle: CRUD, token management, or revocation
 */
@Injectable()
export class SessionContextRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

  /**
   * Single-query auth context: session + user + roles in one round trip.
   *
   * Revocation is detected by the WHERE clause (`refreshTokenRevokedAt IS NULL`):
   * a revoked session simply isn't returned.
   *
   * Returns multiple rows (one per role assignment); caller deduplicates session +
   * user from the first row and collects roles from all rows.
   */
  async findSessionAuthContext(token: string): Promise<{
    session: UserSession | null;
    user: typeof schema.users.$inferSelect | null;
    roles: Array<{
      roleId: number;
      roleCode: string;
      storeFk: number | null;
      storeGuuid: string | null;
      storeName: string | null;
      isPrimary: boolean;
      assignedAt: Date;
      expiresAt: Date | null;
    }>;
  }> {
    const rows = await this.db
      .select({
        session: schema.userSession,
        user: schema.users,
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        storeFk: userRoleMapping.storeFk,
        storeGuuid: schema.store.guuid,
        storeName: schema.store.storeName,
        isPrimary: userRoleMapping.isPrimary,
        assignedAt: userRoleMapping.assignedAt,
        expiresAt: userRoleMapping.expiresAt,
      })
      .from(schema.userSession)
      .innerJoin(
        schema.users,
        and(
          eq(schema.userSession.userId, schema.users.id),
          isNull(schema.users.deletedAt),
        ),
      )
      .leftJoin(
        userRoleMapping,
        and(
          eq(userRoleMapping.userFk, schema.users.id),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
          or(
            isNull(userRoleMapping.expiresAt),
            gt(userRoleMapping.expiresAt, new Date()),
          ),
        ),
      )
      .leftJoin(
        schema.roles,
        and(
          eq(userRoleMapping.roleFk, schema.roles.id),
          eq(schema.roles.isActive, true),
          isNull(schema.roles.deletedAt),
        ),
      )
      .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
      .where(
        and(
          eq(schema.userSession.token, token),
          isNull(schema.userSession.refreshTokenRevokedAt),
        ),
      );

    if (rows.length === 0) {
      return { session: null, user: null, roles: [] };
    }

    const first = rows[0];
    const session = first.session;
    const user = first.user;

    const roles = rows
      .filter((r) => r.roleId != null)
      .map((r) => ({
        roleId: r.roleId as number,
        roleCode: r.roleCode as string,
        storeFk: r.storeFk ?? null,
        storeGuuid: r.storeGuuid ?? null,
        storeName: r.storeName ?? null,
        isPrimary: r.isPrimary as boolean,
        assignedAt: r.assignedAt as Date,
        expiresAt: r.expiresAt ?? null,
      }));

    return { session, user, roles };
  }

  /**
   * Insert a session and prune the user's row count back to `maxAllowed`.
   *
   * Lock-free: previous implementation used pg_advisory_xact_lock(userId) which
   * serialised every login per-user — a bottleneck for a control whose brief
   * overshoot is harmless. Concurrent inserts can transiently exceed the cap
   * because READ COMMITTED hides uncommitted siblings; SessionCleanupService
   * runs a sweep to converge any residue.
   */
  async createWithinLimit(
    userId: number,
    maxAllowed: number,
    data: NewUserSession,
  ): Promise<UserSession | null> {
    return this.txService.run(async (tx) => {
      const [session] = await tx
        .insert(schema.userSession)
        .values(data)
        .returning();

      await this.pruneToLimit(tx, userId, maxAllowed);

      return session ?? null;
    }, { name: 'SessionContextRepo.createWithinLimit' });
  }

  /** Idempotent: deletes nothing if the user is already at or under the cap. */
  private async pruneToLimit(
    tx: Db | Parameters<Parameters<Db['transaction']>[0]>[0],
    userId: number,
    maxAllowed: number,
  ): Promise<void> {
    const keepIds = tx
      .select({ id: schema.userSession.id })
      .from(schema.userSession)
      .where(eq(schema.userSession.userId, userId))
      .orderBy(desc(schema.userSession.createdAt))
      .limit(maxAllowed);

    await tx
      .delete(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          notInArray(schema.userSession.id, keepIds),
        ),
      );
  }

  /**
   * Periodic safety sweep — prunes every user past `maxAllowed` in one pass.
   * Idempotent. Catches residue left by interleaved commits in createWithinLimit
   * or by code paths that insert without going through it.
   */
  async enforceSessionLimitGlobally(maxAllowed: number): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM user_session
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_fk ORDER BY created_at DESC
          ) AS rn
          FROM user_session
        ) ranked
        WHERE rn > ${maxAllowed}
      )
    `);
    return result.rowCount ?? 0;
  }

  /**
   * Delete old revoked sessions (older than N days)
   * Preserves recent revoked sessions for theft-detection audit trail
   */
  async deleteOldRevokedSessions(olderThanDays = 30, batchSize = 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const condition = and(
      sql`${schema.userSession.refreshTokenRevokedAt} IS NOT NULL`,
      lt(schema.userSession.refreshTokenRevokedAt, cutoffDate),
    );

    let total = 0;
    while (true) {
      const ids = this.db
        .select({ id: schema.userSession.id })
        .from(schema.userSession)
        .where(condition)
        .orderBy(asc(schema.userSession.refreshTokenRevokedAt))
        .limit(batchSize);

      const result = await this.db
        .delete(schema.userSession)
        .where(inArray(schema.userSession.id, ids));

      const deleted = result.rowCount ?? 0;
      total += deleted;
      if (deleted < batchSize) break;
    }
    return total;
  }

  /**
   * Delete all sessions whose expiresAt is before the given cutoff date
   */
  async deleteExpiredSessions(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(lt(schema.userSession.expiresAt, cutoffDate));
    return result.rowCount ?? 0;
  }
}
