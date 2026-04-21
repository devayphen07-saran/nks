import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, lt } from 'drizzle-orm';
import { InjectDb } from '../../../../../core/database/inject-db.decorator';
import * as schema from '../../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * JtiBlocklistService
 *
 * Tracks revoked JWT IDs (jti claims) so that short-lived access tokens
 * are immediately unusable after session termination, not just after their
 * natural 15-minute expiry.
 *
 * Flow:
 *   1. On login, the session row stores the JWT's jti.
 *   2. On logout / session terminate, the jti is written here with
 *      expires_at = now + ACCESS_TOKEN_TTL_MS.
 *   3. AuthGuard checks isBlocked(jti) after validating the session token.
 *
 * Storage: PostgreSQL table `jti_blocklist` (created by migration 023).
 * Cleanup: daily cron removes expired rows — the table stays small because
 *          entries live for at most 15 minutes.
 */
@Injectable()
export class JtiBlocklistService {
  private readonly logger = new Logger(JtiBlocklistService.name);

  // Must match the JWT TTL in token.service.ts / session.service.ts (15 min)
  private readonly ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Add a jti to the blocklist.
   * Called when a session is revoked (logout, terminate, password change).
   *
   * @param jti  UUID string from the JWT's jti claim
   * @param ttlMs  How long to block — defaults to the JWT TTL (15 min)
   */
  async block(jti: string, ttlMs = this.ACCESS_TOKEN_TTL_MS): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.db
      .insert(schema.jtiBlocklist)
      .values({ jti, expiresAt })
      .onConflictDoNothing(); // idempotent — safe to call twice
  }

  /**
   * Check whether a jti is currently blocklisted.
   * Returns false for unknown or expired entries.
   */
  async isBlocked(jti: string): Promise<boolean> {
    const [entry] = await this.db
      .select({ expiresAt: schema.jtiBlocklist.expiresAt })
      .from(schema.jtiBlocklist)
      .where(eq(schema.jtiBlocklist.jti, jti))
      .limit(1);

    if (!entry) return false;
    return entry.expiresAt > new Date();
  }

  /**
   * Remove expired entries — runs daily at 03:00.
   * Entries live at most 15 minutes so this is mostly a tidying operation.
   */
  @Cron('0 3 * * *')
  async cleanupExpired(): Promise<void> {
    const deleted = await this.db
      .delete(schema.jtiBlocklist)
      .where(lt(schema.jtiBlocklist.expiresAt, new Date()))
      .returning({ jti: schema.jtiBlocklist.jti });

    if (deleted.length > 0) {
      this.logger.log(`JTI blocklist cleanup: removed ${deleted.length} expired entries`);
    }
  }
}
