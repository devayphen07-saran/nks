import { Injectable, Logger } from '@nestjs/common';
import { lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { rateLimitEntries } from '../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * RateLimitService — database-backed sliding window counter.
 *
 * Owns all DB interactions for rate limiting so RateLimitingGuard stays
 * a pure decision-maker: extract key → record hit → allow or throw.
 *
 * Algorithm: upsert with CASE-based window reset.
 *   - First hit in a window: insert new row.
 *   - Subsequent hits: increment counter.
 *   - Window expired: reset counter to 1 and start a new window.
 *   Cleanup of stale rows is fire-and-forget (never blocks the request path).
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Record one hit for `key` within a sliding `windowMs` window.
   * Returns the updated hit count for the current window.
   */
  async recordHit(key: string, windowMs: number): Promise<number> {
    const now = new Date();
    const windowCutoff = new Date(now.getTime() - windowMs);
    const windowExpiresAt = new Date(now.getTime() + windowMs);

    void this.db
      .delete(rateLimitEntries)
      .where(lt(rateLimitEntries.expiresAt, now))
      .catch((err: unknown) => {
        this.logger.error(
          `Rate-limit cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    const rows = await this.db
      .insert(rateLimitEntries)
      .values({ key, hits: 1, windowStart: now, expiresAt: windowExpiresAt })
      .onConflictDoUpdate({
        target: rateLimitEntries.key,
        set: {
          hits: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN 1
            ELSE ${rateLimitEntries.hits} + 1
          END`,
          windowStart: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN ${now}
            ELSE ${rateLimitEntries.windowStart}
          END`,
          expiresAt: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN ${windowExpiresAt}
            ELSE ${rateLimitEntries.expiresAt}
          END`,
        },
      })
      .returning({ hits: rateLimitEntries.hits });

    return rows[0]?.hits ?? 1;
  }
}
