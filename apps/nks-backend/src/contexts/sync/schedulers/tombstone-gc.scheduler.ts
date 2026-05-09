import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { lt, isNotNull, and, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { TOMBSTONE_TARGETS, TOMBSTONE_TTL_DAYS } from '../sync.constants';

export interface TombstoneTarget {
  readonly name: string;
  readonly table: PgTable & {
    deletedAt: { name: string };
    id: { name: string };
  };
}

const BATCH_SIZE = 1000;

@Injectable()
export class TombstoneGcScheduler {
  private readonly logger = new Logger(TombstoneGcScheduler.name);

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    @Inject(TOMBSTONE_TARGETS) private readonly targets: TombstoneTarget[],
  ) {}

  // Weekly Sunday at 03:00 UTC.
  @Cron('0 3 * * 0')
  async handleWeeklyGc(): Promise<void> {
    if (this.targets.length === 0) return;

    const cutoff = new Date(Date.now() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000);

    for (const target of this.targets) {
      await this.gcTarget(target, cutoff).catch((err) => {
        this.logger.error(
          `Tombstone GC failed for '${target.name}': ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  private async gcTarget(target: TombstoneTarget, cutoff: Date): Promise<void> {
    const start = Date.now();
    const idCol = (target.table as unknown as Record<string, never>)['id'] as never;
    const deletedAtCol = (target.table as unknown as Record<string, never>)['deletedAt'] as never;

    const expired = await this.db
      .select({ id: idCol })
      .from(target.table as never)
      .where(and(isNotNull(deletedAtCol), lt(deletedAtCol, cutoff)))
      .limit(BATCH_SIZE);

    if (expired.length === 0) {
      this.logger.debug(`Tombstone GC '${target.name}': nothing to purge`);
      return;
    }

    const ids = expired.map((row) => (row as { id: number }).id);
    await this.db.delete(target.table as never).where(inArray(idCol, ids as never));

    this.logger.log(
      `Tombstone GC '${target.name}': purged ${ids.length} row(s) (TTL=${TOMBSTONE_TTL_DAYS}d, took ${Date.now() - start}ms)`,
    );

    if (ids.length === BATCH_SIZE) {
      this.logger.warn(
        `Tombstone GC '${target.name}': hit batch ceiling (${BATCH_SIZE}); more rows may remain`,
      );
    }
  }
}
