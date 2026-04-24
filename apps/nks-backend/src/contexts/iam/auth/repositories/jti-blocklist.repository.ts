import { Injectable } from '@nestjs/common';
import { eq, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * JtiBlocklistRepository — row-level operations on the `jti_blocklist` table.
 *
 * The table is tiny (entries live at most `ACCESS_TOKEN_TTL_MS`), so we don't
 * bother with pagination or bulk readers here. Caller is `JtiBlocklistService`,
 * which owns the cron scheduling, logging, and TTL policy.
 */
@Injectable()
export class JtiBlocklistRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  /**
   * Insert a blocklist row. Idempotent — ON CONFLICT DO NOTHING keeps this
   * safe to call from parallel logout paths (JWT blocklist + session delete).
   */
  async insert(jti: string, expiresAt: Date): Promise<void> {
    await this.db
      .insert(schema.jtiBlocklist)
      .values({ jti, expiresAt })
      .onConflictDoNothing();
  }

  /**
   * Return the row's expiry if a jti is currently listed, else null.
   * Callers compare against `new Date()` to decide if the block is still live.
   */
  async findExpiryByJti(jti: string): Promise<Date | null> {
    const [entry] = await this.db
      .select({ expiresAt: schema.jtiBlocklist.expiresAt })
      .from(schema.jtiBlocklist)
      .where(eq(schema.jtiBlocklist.jti, jti))
      .limit(1);
    return entry?.expiresAt ?? null;
  }

  /**
   * Delete all rows whose `expiresAt` is in the past. Returns row count.
   */
  async deleteExpired(now: Date): Promise<number> {
    const result = await this.db
      .delete(schema.jtiBlocklist)
      .where(lt(schema.jtiBlocklist.expiresAt, now));
    return result.rowCount ?? 0;
  }
}
