import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionRevocationRepository - Session revocation and rotation status.
 * Handles: revoke operations, rotation status flags.
 * Does NOT handle: CRUD, token lifecycle, or cleanup.
 *
 * Note: Audit logging is done at the service layer (SessionCommandService)
 * via AuditCommandService, not here.
 */
@Injectable()
export class SessionRevocationRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  /**
   * Revoke refresh token only (mark as revoked for theft detection)
   */
  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ refreshTokenRevokedAt: new Date() })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Soft-revoke a session: mark refreshTokenRevokedAt + reason and null out
   * refreshTokenHash.
   *
   * Clearing refreshTokenHash is critical: if it stays set, a post-logout refresh
   * attempt finds the session row (hash still matches), then TokenTheftDetectionService
   * sees refreshTokenRevokedAt is set and terminates ALL sessions for that user.
   * Nulling the hash makes findByRefreshTokenHashForUpdate return nothing, so the
   * refresh fails cleanly with AUTH_REFRESH_TOKEN_INVALID instead.
   *
   * Row is NOT deleted — retained for audit trail.
   */
  async revokeSession(sessionId: number, revokedReason = 'LOGOUT'): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ refreshTokenRevokedAt: new Date(), revokedReason, refreshTokenHash: null })
      .where(eq(schema.userSession.id, sessionId));
  }

  /**
   * Soft-revoke all active sessions for a user. Rows are NOT deleted —
   * retained for audit and theft detection.
   */
  async revokeAllForUser(userId: number, revokedReason: string): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ refreshTokenRevokedAt: new Date(), revokedReason })
      .where(eq(schema.userSession.userId, userId));
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
}
