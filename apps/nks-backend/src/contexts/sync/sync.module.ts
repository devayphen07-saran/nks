import { Module } from '@nestjs/common';
import { RolesModule } from '../iam/roles/roles.module';
import { AuthModule } from '../iam/auth/auth.module';
import { GuardsModule } from '../../common/guards/guards.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncRepository } from './repositories/sync.repository';
import { SyncHandlerFactory } from './handlers/sync-handler.factory';
import { SyncValidationService } from './services/sync-validation.service';
import { SyncIdempotencyService } from './services/sync-idempotency.service';

@Module({
  imports: [GuardsModule, RolesModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncService, SyncRepository, SyncHandlerFactory, SyncValidationService, SyncIdempotencyService],
  exports: [SyncService, SyncRepository, SyncHandlerFactory],
})
export class SyncModule {}
