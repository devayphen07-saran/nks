import { Module } from '@nestjs/common';
import { RolesModule } from '../iam/roles/roles.module';
import { AuthCoreModule } from '../iam/auth/auth-core.module';
import { GuardsModule } from '../../common/guards/guards.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncRepository } from './repositories/sync.repository';
import { RevokedDevicesRepository } from '../iam/auth/repositories/revoked-devices.repository';
import { SyncHandlerFactory } from './handlers/sync-handler.factory';

@Module({
  imports: [GuardsModule, RolesModule, AuthCoreModule],
  controllers: [SyncController],
  // RevokedDevicesRepository is also exported by AuthCoreModule; listed here
  // explicitly so the provider token is unambiguous within this module.
  providers: [
    SyncService,
    SyncRepository,
    RevokedDevicesRepository,
    SyncHandlerFactory,
  ],
  exports: [SyncService, SyncRepository, SyncHandlerFactory],
})
export class SyncModule {}
