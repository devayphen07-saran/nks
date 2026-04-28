import { Injectable } from '@nestjs/common';
import { eq, and, gt, lt, or, isNull, asc, desc, count, sql, notInArray, inArray, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import { ACCESS_TOKEN_TTL_MS } from '../auth.constants';
import { AUTH_CONSTANTS } from '../../../../common/constants/app-constants';
import type { UserSession, NewUserSession, UpdateUserSession } from '../../../../core/database/schema/auth/user-session';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionsRepository
 * Handles all database operations for user sessions
 * Responsibilities:
 * - Create sessions
 * - Find sessions by ID, token, or user
 * - Update session data
 * - Revoke sessions
 * - Clean up expired sessions
 */
@Injectable()
export class SessionsRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

  /** Reusable WHERE clause: sessions belonging to userId that have not yet expired. */
  private activeSessionWhere(userId: number) {
    return and(
      eq(schema.userSession.userFk, userId),
      gt(schema.userSession.expiresAt, new Date()),
    );
  }

  /**
   * Create a new user session
   */
  async create(data: NewUserSession): Promise<UserSession | null> {
    const [session] = await this.db
      .insert(schema.userSession)
      .values(data)
      .returning();

    return session ?? null;
  }

  /**
   * Find session by ID
   */
  async findById(sessionId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.id, sessionId))
      .limit(1);

    return session ?? null;
  }

  /**
   * Find session by token, atomically checking the JTI blocklist in a single JOIN.
   * Eliminates the TOCTOU race where a concurrent logout could insert the JTI between
   * a separate session fetch and a subsequent blocklist query.
   */
  async findByTokenWithJtiCheck(token: string): Promise<{
    session: UserSession | null;
    revokedJti: string | null;
  }> {
    const [row] = await this.db
      .select({
        session: schema.userSession,
        revokedJti: schema.jtiBlocklist.jti,
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
      .where(eq(schema.userSession.token, token))
      .limit(1);

    return { session: row?.session ?? null, revokedJti: row?.revokedJti ?? null };
  }

  /**
   * Single-query auth context: session + JTI check + user + roles in one round trip.
   *
   * JOINs:
   *   LEFT  JOIN jti_blocklist          — detect revoked JTI atomically
   *   INNER JOIN users                  — user must exist and not be soft-deleted
   *   LEFT  JOIN user_role_mapping      — active, non-expired role assignments
   *   INNER JOIN roles (via mapping)    — role must be active and not soft-deleted
   *   LEFT  JOIN store (via mapping)    — resolve store guuid/name for scoped roles
   *
   * Returns multiple rows (one per role assignment). Caller deduplicates:
   *   - session + user + revokedJti  → first row
   *   - roles                        → collect from all rows, filter null roleId
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
          eq(schema.userSession.userFk, schema.users.id),
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
   * Find session by token
   */
  async findByToken(token: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.token, token))
      .limit(1);

    return session ?? null;
  }

  /**
   * Find all sessions for a user
   */
  async findByUserId(userId: number): Promise<UserSession[]> {
    return this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.userFk, userId))
      .orderBy(asc(schema.userSession.createdAt));
  }

  /**
   * Find active sessions for a user (not expired)
   */
  async findActiveByUserId(userId: number): Promise<UserSession[]> {
    return this.db
      .select()
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt);
  }

  /**
   * Update session data
   */
  async update(sessionId: number, data: UpdateUserSession): Promise<UserSession | null> {
    const [updated] = await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.id, sessionId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a session
   */
  async delete(sessionId: number): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.id, sessionId));

    return result.rowCount ?? 0;
  }

  /**
   * Revoke refresh token (mark as revoked for theft detection)
   */
  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ refreshTokenRevokedAt: new Date() })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Atomically revoke the refresh token and hard-delete the session in one transaction.
   *
   * Using two separate calls (revokeRefreshToken then delete) would leave a brief
   * window where a concurrent rotation could see refreshTokenRevokedAt set and
   * trigger the theft-detection alarm on a legitimate logout. Wrapping both in a
   * transaction eliminates that window: other transactions either see the row in its
   * original state (blocked by our lock) or see it gone after we commit.
   */
  /**
   * Soft-revoke a session: mark refreshTokenRevokedAt + reason, blocklist the JTI.
   * The row is NOT deleted — it stays for audit trail and theft-detection purposes.
   * SessionCleanupService.cleanupOldRevokedSessions() removes rows after 30 days.
   */
  async revokeSession(sessionId: number, revokedReason = 'LOGOUT', jti?: string): Promise<void> {
    await this.txService.run(async (tx) => {
      if (jti) {
        const jtiExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
        await tx
          .insert(schema.jtiBlocklist)
          .values({ jti, expiresAt: jtiExpiresAt })
          .onConflictDoNothing();
      }
      await tx
        .update(schema.userSession)
        .set({ refreshTokenRevokedAt: new Date(), revokedReason })
        .where(eq(schema.userSession.id, sessionId));
    }, { name: 'SessionsRepo.revokeSession' });
  }

  /**
   * Mark session as rotated (refresh token was rotated)
   */
  async markAsRotated(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ isRefreshTokenRotated: true })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Return all non-null JTIs for a user's sessions.
   * Called before deleteAllForUser so callers can blocklist tokens first.
   */
  async findJtisByUserId(userId: number): Promise<string[]> {
    const rows = await this.db
      .select({ jti: schema.userSession.jti })
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userFk, userId),
          isNotNull(schema.userSession.jti),
        ),
      );
    return rows.map((r) => r.jti as string);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: number): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userFk, userId));

    return result.rowCount ?? 0;
  }

  /**
   * Delete expired sessions in batches to avoid long table locks.
   * Uses a subquery (DELETE WHERE id IN (SELECT id ... LIMIT batchSize)) because
   * PostgreSQL does not support LIMIT directly on DELETE statements.
   * Returns total rows deleted across all batches.
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
   * Set active store for a session (user selected a store after login).
   */
  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: storeId })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Clear the active store from a session — called when AuthGuard detects
   * the stored activeStoreId no longer maps to a live role assignment.
   */
  async clearActiveStore(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: null })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Get session count for user (for enforcing session limit)
   */
  async getActiveSessionCount(userId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId));

    return result?.count ?? 0;
  }

  /**
   * Find oldest session for a user (for removing when limit exceeded)
   */
  async findOldestActiveSession(userId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt)
      .limit(1);

    return session ?? null;
  }

  /**
   * Find session by guuid (no lock).
   */
  async findByGuuid(guuid: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.guuid, guuid))
      .limit(1);

    return session ?? null;
  }

  /**
   * Find session by guuid with exclusive lock (FOR UPDATE).
   * Used for atomic refresh token rotation to prevent concurrent rotations.
   */
  async findByGuuidForUpdate(guuid: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.guuid, guuid))
      .for('update')
      .limit(1);

    return session ?? null;
  }

  /**
   * Find session by refresh token hash with exclusive lock (FOR UPDATE).
   * Used for opaque token lookup during refresh (no UUID exposed in token).
   */
  async findByRefreshTokenHashForUpdate(
    refreshTokenHash: string,
  ): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.refreshTokenHash, refreshTokenHash))
      .for('update')
      .limit(1);

    return session ?? null;
  }

  /**
   * Update session by session token (not ID).
   * Returns the session guuid — used in createSessionForUser to capture guuid after device update.
   */
  async updateByToken(
    token: string,
    data: UpdateUserSession,
  ): Promise<{ guuid: string } | null> {
    const [updated] = await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.token, token))
      .returning({ guuid: schema.userSession.guuid });

    return updated ?? null;
  }

  /**
   * Store refresh token data for a session identified by its BetterAuth token.
   * Called from createTokenPair() after generating the structured refresh token.
   */
  async setRefreshTokenData(
    sessionToken: string,
    data: {
      refreshTokenHash: string;
      refreshTokenExpiresAt: Date;
      accessTokenExpiresAt: Date;
    },
  ): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.token, sessionToken));
  }

  /**
   * Revoke all sessions for a user with a reason (theft detection response).
   * Both the revocation mark and the deletion are wrapped in a single transaction
   * so a crash between the two cannot leave sessions alive post-theft-detection.
   */
  /**
   * Soft-revoke all active sessions for a user: mark refreshTokenRevokedAt + reason,
   * blocklist all JTIs. Rows are NOT deleted — retained for audit and theft detection.
   */
  async revokeAllForUser(
    userId: number,
    revokedReason: string,
    jtis: string[] = [],
  ): Promise<void> {
    await this.txService.run(async (tx) => {
      if (jtis.length > 0) {
        const jtiExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
        await tx
          .insert(schema.jtiBlocklist)
          .values(jtis.map((jti) => ({ jti, expiresAt: jtiExpiresAt })))
          .onConflictDoNothing();
      }
      await tx
        .update(schema.userSession)
        .set({ refreshTokenRevokedAt: new Date(), revokedReason })
        .where(eq(schema.userSession.userFk, userId));
    }, { name: 'SessionsRepo.revokeAllForUser' });
  }

  /**
   * Get all sessions for a user ordered by creation date.
   * Used by enforceSessionLimit to find and remove oldest sessions.
   */
  async findAllByUserIdOrdered(
    userId: number,
  ): Promise<Array<{ id: number; createdAt: Date | null }>> {
    return this.db
      .select({
        id: schema.userSession.id,
        createdAt: schema.userSession.createdAt,
      })
      .from(schema.userSession)
      .where(eq(schema.userSession.userFk, userId))
      .orderBy(asc(schema.userSession.createdAt));
  }

  /**
   * FIX #5 / Issue #16: Atomic session limit enforcement + insert in a single transaction.
   *
   * Wrapping DELETE + INSERT in one transaction eliminates the TOCTOU race where two
   * concurrent logins both see "N sessions" before either writes, then both insert —
   * ending up with N+2 sessions. With a transaction the delete and insert are
   * serialised at the DB level: one login wins, the other sees the updated state.
   *
   * @param userId     - User whose sessions to cap
   * @param maxAllowed - Maximum concurrent sessions (new session already counted in budget)
   * @param data       - Session row to insert
   */
  async createWithinLimit(
    userId: number,
    maxAllowed: number,
    data: NewUserSession,
  ): Promise<UserSession | null> {
    return this.txService.run(async (tx) => {
      // Serialize concurrent session creation for the same user.
      // pg_advisory_xact_lock is scoped to the transaction and released automatically
      // at commit/rollback — no manual unlock needed.
      // Without this, two concurrent logins can both read the pre-delete state,
      // both select the same keepIds, and both insert — temporarily exceeding the limit.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);

      // DELETE all sessions beyond the (maxAllowed - 1) most recent,
      // making room for the new one we are about to insert.
      const keepIds = tx
        .select({ id: schema.userSession.id })
        .from(schema.userSession)
        .where(eq(schema.userSession.userFk, userId))
        .orderBy(desc(schema.userSession.createdAt))
        .limit(maxAllowed - 1);

      await tx
        .delete(schema.userSession)
        .where(
          and(
            eq(schema.userSession.userFk, userId),
            notInArray(schema.userSession.id, keepIds),
          ),
        );

      const [session] = await tx
        .insert(schema.userSession)
        .values(data)
        .returning();

      return session ?? null;
    }, { name: 'SessionsRepo.createWithinLimit' });
  }

  /**
   * Find session by numeric ID and user ID — verifies ownership.
   */
  async findByIdAndUserId(
    sessionId: number,
    userId: number,
  ): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.id, sessionId),
          eq(schema.userSession.userFk, userId),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  /**
   * Get active sessions for a user with selected device fields.
   * Used for listing sessions in the session management API.
   */
  async findActiveSessionsForUser(userId: number): Promise<
    Array<{
      id: number;
      deviceId: string | null;
      deviceName: string | null;
      deviceType: string | null;
      platform: string | null;
      appVersion: string | null;
      createdAt: Date | null;
      expiresAt: Date;
    }>
  > {
    return this.db
      .select({
        id: schema.userSession.id,
        deviceId: schema.userSession.deviceId,
        deviceName: schema.userSession.deviceName,
        deviceType: schema.userSession.deviceType,
        platform: schema.userSession.platform,
        appVersion: schema.userSession.appVersion,
        createdAt: schema.userSession.createdAt,
        expiresAt: schema.userSession.expiresAt,
      })
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt);
  }

  /**
   * Atomically rotate the refresh token in-place using Compare-And-Swap.
   *
   * Updates the existing session row — no new row created. The CAS condition
   * `WHERE refreshTokenHash = oldHash` guarantees that a concurrent refresh
   * which already replaced the hash will cause this UPDATE to match 0 rows
   * (returns false). Caller treats false as a race — not theft.
   *
   * In-place rotation eliminates the session-row proliferation that the
   * old create-new / mark-old pattern caused (one extra row per refresh).
   * Rows now stay bounded to active sessions only.
   */
  async rotateRefreshTokenInPlace(
    sessionId: number,
    oldRefreshTokenHash: string,
    updates: UpdateUserSession,
  ): Promise<boolean> {
    const result = await this.db
      .update(schema.userSession)
      .set(updates)
      .where(
        and(
          eq(schema.userSession.id, sessionId),
          eq(schema.userSession.refreshTokenHash, oldRefreshTokenHash),
        ),
      )
      .returning({ id: schema.userSession.id });

    return result.length > 0;
  }

  /**
   * Delete old revoked sessions in batches to avoid long table locks.
   * Preserves recent revoked sessions for theft-detection audit trail.
   * Returns total rows deleted across all batches.
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
   * Delete all sessions whose expiresAt is before the given cutoff date.
   * Intended for the cleanup scheduler; callers compute the cutoff (including
   * any grace period) before calling here.
   */
  async deleteExpiredSessions(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(lt(schema.userSession.expiresAt, cutoffDate));
    return result.rowCount ?? 0;
  }

  /**
   * Rolling session: atomically rotate the opaque session token.
   *
   * Uses a Compare-And-Swap (WHERE token = oldToken) so concurrent rotation
   * attempts on the same session are safe: the first wins, the second returns
   * false without modifying state.
   *
   * @returns true if rotation applied (row updated), false if another
   * concurrent request already rotated this token.
   */
  async rotateToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date,
    newCsrfSecret: string,
  ): Promise<boolean> {
    // Double guard: CAS on token value (prevents any concurrent rotation from
    // overwriting a rotation that already completed) PLUS a lastRotatedAt
    // interval check (prevents DB-level rotation even if the guard's in-memory
    // check was bypassed, e.g. by a clock skew or a cache race).
    const rotationThreshold = new Date(
      Date.now() - AUTH_CONSTANTS.SESSION.ROTATION_INTERVAL_SECONDS * 1000,
    );
    const [updated] = await this.db
      .update(schema.userSession)
      .set({ token: newToken, lastRotatedAt: new Date(), expiresAt: newExpiresAt, csrfSecret: newCsrfSecret })
      .where(
        and(
          eq(schema.userSession.token, oldToken),
          or(
            isNull(schema.userSession.lastRotatedAt),
            lt(schema.userSession.lastRotatedAt, rotationThreshold),
          ),
        ),
      )
      .returning({ id: schema.userSession.id });
    return !!updated;
  }

  async rotateCsrfSecret(sessionId: number, newCsrfSecret: string): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ csrfSecret: newCsrfSecret })
      .where(eq(schema.userSession.id, sessionId));
  }
}
