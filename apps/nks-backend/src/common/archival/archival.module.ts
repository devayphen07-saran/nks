import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ArchivalService } from './archival.service';
import { ArchivalScheduler } from './archival.scheduler';
import { ARCHIVAL_TARGETS, type ArchivalTarget } from './archival-target';

/**
 * Archival module. Register tables to purge via:
 *
 *     ArchivalModule.forRoot([
 *       { name: 'orders', table: orders, retentionDays: 90 },
 *     ])
 *
 * Targets are merged at AppModule import time. Consumer modules that inject
 * ArchivalService must import this module explicitly.
 *
 * Master switch: `ARCHIVAL_ENABLED=true` (default false). Per-target switch:
 * `ARCHIVAL_<NAME>_RETENTION_DAYS=0` disables one table without disabling all.
 */
@Module({})
export class ArchivalModule {
  static forRoot(targets: ArchivalTarget[] = []): DynamicModule {
    const targetsProvider: Provider = {
      provide: ARCHIVAL_TARGETS,
      useValue: targets,
    };

    return {
      module: ArchivalModule,
      providers: [targetsProvider, ArchivalService, ArchivalScheduler],
      exports: [ArchivalService],
    };
  }
}