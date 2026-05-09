import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { lt, isNotNull, and, inArray, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { ARCHIVAL_TARGETS, type ArchivalTarget } from './archival-target';

const DEFAULT_BATCH_SIZE = 1000;

@Injectable()
export class ArchivalService {
  private readonly logger = new Logger(ArchivalService.name);

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    @Inject(ARCHIVAL_TARGETS) private readonly targets: ArchivalTarget[],
    private readonly configService: ConfigService,
  ) {}

  /**
   * Purge each registered target's soft-deleted rows whose deletedAt is older
   * than (now - retentionDays). Per-target retention can be overridden via
   * `ARCHIVAL_<NAME>_RETENTION_DAYS` (set to 0 to disable that target).
   *
   * Each target runs in its own try/catch so one table's failure does not
   * abort the others.
   */
  async runOnce(): Promise<void> {
    for (const target of this.targets) {
      await this.purgeTarget(target).catch((err) => {
        this.logger.error(
          `Archival failed for '${target.name}': ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  private async purgeTarget(target: ArchivalTarget): Promise<void> {
    const envOverride = this.configService.get<number>(
      `ARCHIVAL_${target.name.toUpperCase()}_RETENTION_DAYS`,
    );
    const retentionDays = envOverride ?? target.retentionDays;
    if (retentionDays <= 0) {
      this.logger.debug(`Archival target '${target.name}' disabled (retention=${retentionDays})`);
      return;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const batchSize = target.batchSize ?? DEFAULT_BATCH_SIZE;
    const start = Date.now();

    // Two-step delete: SELECT a bounded batch of expired ids, then DELETE by id.
    // Avoids long-held locks that a single open-ended DELETE would cause on
    // tables with many candidate rows.
    const idCol = (target.table as unknown as Record<string, never>)['id'] as never;
    const deletedAtCol = (target.table as unknown as Record<string, never>)['deletedAt'] as never;

    const expired = await this.db
      .select({ id: idCol })
      .from(target.table as never)
      .where(and(isNotNull(deletedAtCol), lt(deletedAtCol, cutoff)))
      .limit(batchSize);

    if (expired.length === 0) {
      this.logger.debug(`Archival '${target.name}': nothing to purge`);
      return;
    }

    const ids = expired.map((row) => (row as { id: number | string }).id);
    await this.db
      .delete(target.table as never)
      .where(inArray(idCol, ids as never));

    this.logger.log(
      `Archival '${target.name}': purged ${ids.length} row(s) (retention=${retentionDays}d, took ${Date.now() - start}ms)`,
    );

    // If we hit the batch ceiling there's likely more — surface it so ops can
    // tune batchSize or run a manual sweep.
    if (ids.length === batchSize) {
      this.logger.warn(
        `Archival '${target.name}': hit batch ceiling (${batchSize}); more rows may remain`,
      );
    }
  }

  // Wired in case future targets need raw SQL escapes.
  protected raw(s: string) { return sql.raw(s); }
}