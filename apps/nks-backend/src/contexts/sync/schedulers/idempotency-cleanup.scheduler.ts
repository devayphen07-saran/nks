import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { lt } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { processedOperations } from '../../../core/database/schema';
import { IDEMPOTENCY_TTL_DAYS } from '../sync.constants';

@Injectable()
export class IdempotencyCleanupScheduler {
  private readonly logger = new Logger(IdempotencyCleanupScheduler.name);

  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  // Daily at 02:00 UTC — well before TombstoneGcScheduler (03:00 Sunday).
  @Cron('0 2 * * *')
  async handleDailyCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000);
    const start = Date.now();
    try {
      const result = await this.db
        .delete(processedOperations)
        .where(lt(processedOperations.processedAt, cutoff));
      this.logger.log(
        `Idempotency cleanup: deleted ${result.rowCount ?? 0} row(s) older than ${IDEMPOTENCY_TTL_DAYS}d (took ${Date.now() - start}ms)`,
      );
    } catch (err) {
      this.logger.error(
        `Idempotency cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}