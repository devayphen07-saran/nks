import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { eq, and, gt, lt, asc, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { UserSession, NewUserSession, UpdateUserSession } from '../../../core/database/schema/auth/user-session';

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
export class SessionsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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
      .orderBy(schema.userSession.createdAt);
  }

  /**
   * Find active sessions for a user (not expired)
   */
  async findActiveByUserId(userId: number): Promise<UserSession[]> {
    return this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          gt(schema.userSession.expiresAt, new Date()),
        ),
      )
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
  async delete(sessionId: number): Promise<void> {
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.id, sessionId));
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
   * Delete expired sessions (cleanup)
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(lt(schema.userSession.expiresAt, new Date()));

    return result.rowCount ?? 0;
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
      .where(
        and(
          eq(schema.userSession.userId, userId),
          gt(schema.userSession.expiresAt, new Date()),
        ),
      );

    return result?.count ?? 0;
  }

  /**
   * Find oldest session for a user (for removing when limit exceeded)
   */
  async findOldestActiveSession(userId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          gt(schema.userSession.expiresAt, new Date()),
        ),
      )
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
   * Find session by token and return a new session record.
   * Used after BetterAuth creates a session to fetch the typed row.
   */
  async findByTokenFull(token: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.token, token))
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
   * Sets revokedReason before deletion for audit trail.
   */
  async revokeAndDeleteAllForUser(
    userId: number,
    revokedReason: string,
  ): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ refreshTokenRevokedAt: new Date(), revokedReason })
      .where(eq(schema.userSession.userId, userId));

    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId));
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
      .where(
        and(
          eq(schema.userSession.userId, userId),
          gt(schema.userSession.expiresAt, new Date()),
        ),
      );
  }

  /**
   * Delete old revoked sessions (older than 30 days).
   * Prevents database bloat from session rotation while preserving recent audit trail.
   * Returns count of deleted sessions.
   */
  async deleteOldRevokedSessions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(schema.userSession)
      .where(
        and(
          this.db.sql`${schema.userSession.refreshTokenRevokedAt} IS NOT NULL`,
          lt(schema.userSession.refreshTokenRevokedAt, cutoffDate),
        ),
      );

    return result.rowCount ?? 0;
  }
}
