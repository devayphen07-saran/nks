import { Injectable } from '@nestjs/common';
import { eq, and, isNull, or, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { AUTH_CONSTANTS } from '../../../../common/constants/app-constants';
import type { UserSession, UpdateUserSession } from '../../../../core/database/schema/auth/user-session';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionTokenRepository - Token lifecycle management
 * Handles: token rotation, refresh token updates, CSRF rotation
 * Does NOT handle: CRUD, revocation, or cleanup
 */
@Injectable()
export class SessionTokenRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  /**
   * Find session by guuid with exclusive lock for atomic rotation
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
   * Find session by refresh token hash with exclusive lock
   */
  async findByRefreshTokenHashForUpdate(refreshTokenHash: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.refreshTokenHash, refreshTokenHash))
      .for('update')
      .limit(1);
    return session ?? null;
  }

  /**
   * Update session by token. Returns the row's numeric id and guuid so
   * callers can use either: id for backend writes (FK targets, audit log
   * linkage), guuid for client-facing identifiers.
   */
  async updateByToken(
    token: string,
    data: UpdateUserSession,
  ): Promise<{ id: number; guuid: string } | null> {
    const [updated] = await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.token, token))
      .returning({
        id: schema.userSession.id,
        guuid: schema.userSession.guuid,
      });
    return updated ?? null;
  }

  /**
   * Store refresh token data for a session identified by session token
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
   * Atomically rotate refresh token in-place using Compare-And-Swap
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
   * Rolling session: atomically rotate the opaque session token.
   * The WHERE clause guards against double rotation under concurrent requests —
   * losers see lastRotatedAt > threshold and the UPDATE matches zero rows.
   */
  async rotateToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date,
  ): Promise<boolean> {
    const rotationThreshold = new Date(
      Date.now() - AUTH_CONSTANTS.SESSION.ROTATION_INTERVAL_SECONDS * 1000,
    );

    const [updated] = await this.db
      .update(schema.userSession)
      .set({
        token: newToken,
        lastRotatedAt: new Date(),
        expiresAt: newExpiresAt,
      })
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
}