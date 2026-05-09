import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ArchivalService } from './archival.service';

/**
 * Daily archival job. Disabled by default — operators must set
 * `ARCHIVAL_ENABLED=true` to opt in. Schedule defaults to 02:15 UTC; override
 * via `ARCHIVAL_CRON` (any valid @nestjs/schedule cron expression).
 *
 * The cron expression is read at module-init time; a redeploy is required to
 * change it because @nestjs/schedule's @Cron decorator binds at registration.
 */
@Injectable()
export class ArchivalScheduler implements OnModuleInit {
  private readonly logger = new Logger(ArchivalScheduler.name);
  private enabled = false;

  constructor(
    private readonly archival: ArchivalService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.enabled = this.configService.get<boolean>('ARCHIVAL_ENABLED', false);
    this.logger.log(
      this.enabled
        ? 'Archival scheduler ENABLED — soft-deleted rows will be purged daily'
        : 'Archival scheduler disabled (set ARCHIVAL_ENABLED=true to opt in)',
    );
  }

  @Cron('15 2 * * *')
  async handleDailyArchival(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.archival.runOnce();
    } catch (err) {
      this.logger.error(
        `Archival cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
