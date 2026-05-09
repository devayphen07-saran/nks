import { Module, type DynamicModule, type Provider, Injectable, OnModuleInit } from '@nestjs/common';
import { IdempotencyCleanupScheduler } from './schedulers/idempotency-cleanup.scheduler';
import {
  TombstoneGcScheduler,
  type TombstoneTarget,
} from './schedulers/tombstone-gc.scheduler';
import { TOMBSTONE_TARGETS } from './sync.constants';
import { SyncCursorService } from './services/sync-cursor.service';
import { IdempotencyService } from './services/idempotency.service';
import { DispatcherService } from './services/dispatcher.service';
import { SyncService } from './sync.service';
import { SyncController } from './controllers/sync.controller';
import { DeviceAuthGuard } from './guards/device-auth.guard';
import { StateSyncHandler } from './handlers/state-sync.handler';
import { DistrictSyncHandler } from './handlers/district-sync.handler';
import { LookupSyncHandler } from './handlers/lookup-sync.handler';

/**
 * Registers all built-in reference-data sync handlers with the DispatcherService.
 * Runs once at module init before the first request is served.
 */
@Injectable()
class ReferenceDataHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: DispatcherService,
    private readonly stateHandler: StateSyncHandler,
    private readonly districtHandler: DistrictSyncHandler,
    private readonly lookupHandler: LookupSyncHandler,
  ) {}

  onModuleInit() {
    this.dispatcher.register('state', this.stateHandler);
    this.dispatcher.register('district', this.districtHandler);
    this.dispatcher.register('lookup', this.lookupHandler);
  }
}

/**
 * SyncModule wires up the sync infrastructure for Phase 2-4.
 *
 * Provides:
 * - Phase 2 schedulers (IdempotencyCleanupScheduler, TombstoneGcScheduler)
 * - Phase 3 core services (SyncCursorService, IdempotencyService, DispatcherService)
 * - Phase 4 HTTP surface (SyncService, SyncController, DeviceAuthGuard)
 * - Built-in reference-data handlers (state, district, lookup)
 *
 * Register tombstone-eligible domain tables at app boot:
 *
 *   SyncModule.forRoot([
 *     { name: 'customers', table: customers },
 *   ])
 *
 * DatabaseModule is global, so no explicit import is needed here.
 */
@Module({})
export class SyncModule {
  static forRoot(tombstoneTargets: TombstoneTarget[] = []): DynamicModule {
    const targetsProvider: Provider = {
      provide: TOMBSTONE_TARGETS,
      useValue: tombstoneTargets,
    };

    return {
      global: true,
      module: SyncModule,
      controllers: [SyncController],
      providers: [
        targetsProvider,
        IdempotencyCleanupScheduler,
        TombstoneGcScheduler,
        SyncCursorService,
        IdempotencyService,
        DispatcherService,
        SyncService,
        DeviceAuthGuard,
        StateSyncHandler,
        DistrictSyncHandler,
        LookupSyncHandler,
        ReferenceDataHandlerRegistrar,
      ],
      exports: [
        SyncCursorService,
        IdempotencyService,
        DispatcherService,
        SyncService,
        DeviceAuthGuard,
      ],
    };
  }
}
