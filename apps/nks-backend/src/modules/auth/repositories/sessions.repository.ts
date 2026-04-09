import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { eq, and, gt, isNull, lt, sql } from 'drizzle-orm';
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
  async create(data: NewUserSession): Promise<UserSession> {
    const [session] = await this.db
      .insert(schema.userSession)
      .values(data)
      .returning();

    if (!session) throw new InternalServerErrorException('Failed to create session');
    return session;
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
  async update(sessionId: number, data: UpdateUserSession): Promise<UserSession> {
    const [updated] = await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.id, sessionId))
      .returning();

    if (!updated) throw new InternalServerErrorException('Failed to update session');
    return updated;
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
    const sessions = await this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          gt(schema.userSession.expiresAt, new Date()),
        ),
      );

    return sessions.length;
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
}
