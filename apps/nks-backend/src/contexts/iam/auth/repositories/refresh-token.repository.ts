import { Injectable } from '@nestjs/common';
import { eq, and, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { UserSession } from '../../../../core/database/schema/auth/user-session/user-session.table';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class RefreshTokenRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

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

  async revokeAllUserSessions(
    userId: number,
    revokedReason: string = 'TOKEN_REUSE',
  ): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({
        refreshTokenRevokedAt: new Date(),
        isRefreshTokenRotated: true,
        revokedReason,
      })
      .where(eq(schema.userSession.userId, userId));
  }

  async revokeAndRotateToken(
    sessionId: number,
    newRefreshTokenHash: string,
    newRefreshTokenExpiresAt: Date,
  ): Promise<void> {
    // Mark old refresh token as revoked and set new token
    await this.db
      .update(schema.userSession)
      .set({
        refreshTokenRevokedAt: new Date(),
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        isRefreshTokenRotated: true,
        revokedReason: 'ROTATION',
      })
      .where(eq(schema.userSession.id, sessionId));
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
