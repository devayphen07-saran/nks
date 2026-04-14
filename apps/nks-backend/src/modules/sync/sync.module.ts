import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncRepository } from './sync.repository';

@Module({
  imports: [RolesModule],
  controllers: [SyncController],
  providers: [SyncService, SyncRepository],
  exports: [SyncService, SyncRepository],
})
export class SyncModule {}
