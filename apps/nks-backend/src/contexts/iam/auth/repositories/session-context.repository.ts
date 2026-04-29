import { Injectable } from '@nestjs/common';
import { eq, and, isNotNull, isNull, gt, lt, or, sql, inArray, asc, desc, notInArray } from 'drizzle-orm';
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
   * Single-query auth context: session + JTI check + user + roles in one round trip
   *
   * Returns multiple rows (one per role assignment). Caller deduplicates:
   *   - session + user + revokedJti  → first row
   *   - roles                        → collect from all rows
   */
  async findSessionAuthContext(token: string): Promise<{
    session: UserSession | null;
    user: typeof schema.users.$inferSelect | null;
    revokedJti: string | null;
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
        revokedJti: schema.jtiBlocklist.jti,
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
      .leftJoin(
        schema.jtiBlocklist,
        and(
          isNotNull(schema.userSession.jti),
          eq(schema.jtiBlocklist.jti, schema.userSession.jti),
          gt(schema.jtiBlocklist.expiresAt, new Date()),
        ),
      )
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
      return { session: null, user: null, revokedJti: null, roles: [] };
    }

    const first = rows[0];
    const session = first.session;
    const user = first.user;
    const revokedJti = first.revokedJti ?? null;

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

    return { session, user, revokedJti, roles };
  }

  /**
   * Atomic session limit enforcement + insert in a single transaction
   * Eliminates TOCTOU race where two concurrent logins both see "N sessions"
   */
  async createWithinLimit(
    userId: number,
    maxAllowed: number,
    data: NewUserSession,
  ): Promise<UserSession | null> {
    return this.txService.run(async (tx) => {
      // Serialize concurrent session creation for the same user
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);

      // DELETE all sessions beyond the (maxAllowed - 1) most recent
      const keepIds = tx
        .select({ id: schema.userSession.id })
        .from(schema.userSession)
        .where(eq(schema.userSession.userId, userId))
        .orderBy(desc(schema.userSession.createdAt))
        .limit(maxAllowed - 1);

      await tx
        .delete(schema.userSession)
        .where(
          and(
            eq(schema.userSession.userId, userId),
            notInArray(schema.userSession.id, keepIds),
          ),
        );

      const [session] = await tx
        .insert(schema.userSession)
        .values(data)
        .returning();

      return session ?? null;
    }, { name: 'SessionContextRepo.createWithinLimit' });
  }

  /**
   * Delete expired sessions in batches
   */
  async deleteExpired(batchSize = 1000): Promise<number> {
    let total = 0;
    while (true) {
      const ids = this.db
        .select({ id: schema.userSession.id })
        .from(schema.userSession)
        .where(lt(schema.userSession.expiresAt, new Date()))
        .orderBy(asc(schema.userSession.expiresAt))
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
