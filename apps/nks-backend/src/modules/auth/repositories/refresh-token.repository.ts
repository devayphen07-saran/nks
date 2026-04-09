import { Injectable } from '@nestjs/common';
import { eq, and, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { UserSession } from '../../../core/database/schema/auth/user-session/user-session.table';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class RefreshTokenRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findByRefreshTokenHash(tokenHash: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.refreshTokenHash, tokenHash))
      .limit(1);

    return session ?? null;
  }

  async findById(sessionId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.id, sessionId))
      .limit(1);

    return session ?? null;
  }

  async revokeAllUserSessions(userId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({
        refreshTokenRevokedAt: new Date(),
        isRefreshTokenRotated: true,
      })
      .where(eq(schema.userSession.userId, userId));
  }

  async rotateToken(
    sessionId: number,
    newRefreshTokenHash: string,
    newRefreshTokenExpiresAt: Date,
  ): Promise<void> {
    // Wrap entire rotation in transaction for atomicity
    await this.db.transaction(async (tx) => {
      // 1. Mark old session's refresh token as revoked
      await tx
        .update(schema.userSession)
        .set({
          refreshTokenRevokedAt: new Date(),
          isRefreshTokenRotated: true,
        })
        .where(eq(schema.userSession.id, sessionId));

      // 2. Update session with new refresh token
      await tx
        .update(schema.userSession)
        .set({
          refreshTokenHash: newRefreshTokenHash,
          refreshTokenExpiresAt: newRefreshTokenExpiresAt,
          isRefreshTokenRotated: false,
        })
        .where(eq(schema.userSession.id, sessionId));
    });
  }

  async hasRevokedSessions(userId: number): Promise<boolean> {
    const result = await this.db
      .select({ count: schema.userSession.id })
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.userId, userId),
          isNotNull(schema.userSession.refreshTokenRevokedAt),
        ),
      )
      .limit(1);

    return result.length > 0;
  }
}
