import { Injectable } from '@nestjs/common';
import { eq, and, gt, lt, asc, desc, count, sql, notInArray, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
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
      eq(schema.userSession.userId, userId),
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
      .where(eq(schema.userSession.userId, userId))
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
   * Mark session as rotated (refresh token was rotated)
   */
  async markAsRotated(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ isRefreshTokenRotated: true })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: number): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId));

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
   * Set active store for a session (user selected a store after login)
   */
  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: storeId })
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
  async revokeAndDeleteAllForUser(
    userId: number,
    revokedReason: string,
  ): Promise<void> {
    await this.txService.run(async (tx) => {
      await tx
        .update(schema.userSession)
        .set({ refreshTokenRevokedAt: new Date(), revokedReason })
        .where(eq(schema.userSession.userId, userId));

      await tx
        .delete(schema.userSession)
        .where(eq(schema.userSession.userId, userId));
    }, { name: 'SessionsRepo.revokeAndDeleteAllForUser' });
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
      .where(eq(schema.userSession.userId, userId))
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
      // DELETE all sessions beyond the (maxAllowed - 1) most recent,
      // making room for the new one we are about to insert.
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
    }, { name: 'SessionsRepo.createWithinLimit' });
  }

  /**
   * @deprecated Use createWithinLimit — kept for callers that do not need limit enforcement.
   */
  async deleteExcessSessions(
    userId: number,
    maxAllowed: number,
  ): Promise<void> {
    const keepIds = this.db
      .select({ id: schema.userSession.id })
      .from(schema.userSession)
      .where(eq(schema.userSession.userId, userId))
      .orderBy(desc(schema.userSession.createdAt))
      .limit(maxAllowed);

    await this.db
      .delete(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          notInArray(schema.userSession.id, keepIds),
        ),
      );
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
          eq(schema.userSession.userId, userId),
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
   * Atomically rotate the refresh token using Compare-And-Swap.
   *
   * The old session is only marked as rotated if `refresh_token_revoked_at IS NULL`
   * (CAS guard). This prevents the race where two concurrent refreshes both see the
   * old token as valid and both rotate — the second rotation would otherwise cause a
   * false theft-detection on the next attempt.
   *
   * Returns true if rotation succeeded, false if the old session was already rotated
   * (another refresh won the race — caller should re-read the token, not treat as theft).
   */
  async rotateRefreshToken(
    newSessionId: number,
    updates: UpdateUserSession,
    oldSessionId: number,
  ): Promise<boolean> {
    return await this.txService.run(async (tx) => {
      // CAS: only revoke the old session if it hasn't been revoked yet
      const result = await tx
        .update(schema.userSession)
        .set({ refreshTokenRevokedAt: new Date(), revokedReason: 'ROTATION' })
        .where(
          and(
            eq(schema.userSession.id, oldSessionId),
            sql`${schema.userSession.refreshTokenRevokedAt} IS NULL`,
          ),
        )
        .returning({ id: schema.userSession.id });

      if (result.length === 0) {
        // Another refresh already rotated this token — not theft, just a race
        return false;
      }

      // CAS succeeded — update the new session with fresh token data
      await tx
        .update(schema.userSession)
        .set(updates)
        .where(eq(schema.userSession.id, newSessionId));

      return true;
    }, { name: 'SessionsRepo.rotateRefreshToken' });
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
}
