import { Injectable } from '@nestjs/common';
import { eq, and, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import { ACCESS_TOKEN_TTL_MS } from '../auth.constants';
import type { UserSession } from '../../../../core/database/schema/auth/user-session';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionRevocationRepository - Session revocation and JTI blocklist management
 * Handles: revoke operations, JTI blocklisting, rotation status
 * Does NOT handle: CRUD, token lifecycle, or cleanup
 */
@Injectable()
export class SessionRevocationRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

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
   * Soft-revoke a session: mark refreshTokenRevokedAt + reason, blocklist the JTI
   * Row is NOT deleted — retained for audit trail and theft detection
   */
  async revokeSession(
    sessionId: number,
    revokedReason = 'LOGOUT',
    jti?: string,
  ): Promise<void> {
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
    }, { name: 'SessionRevocationRepo.revokeSession' });
  }

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
        .where(eq(schema.userSession.userId, userId));
    }, { name: 'SessionRevocationRepo.revokeAllForUser' });
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
   * Return all non-null JTIs for a user's sessions
   * Called before deleteAllForUser so callers can blocklist tokens first
   */
  async findJtisByUserId(userId: number): Promise<string[]> {
    const rows = await this.db
      .select({ jti: schema.userSession.jti })
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          isNotNull(schema.userSession.jti),
        ),
      );
    return rows.map((r) => r.jti as string);
  }

  /**
   * Find session by token with revocation status check
   */
  async findByTokenWithoutRevocation(token: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.token, token),
          isNotNull(schema.userSession.refreshTokenRevokedAt),
        ),
      )
      .limit(1);
    return session ?? null;
  }
}