import { Module } from '@nestjs/common';
import { EntityStatusController } from './entity-status.controller';
import { AdminEntityStatusController } from './admin-entity-status.controller';
import { EntityStatusService } from './entity-status.service';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { StatusModule } from '../status/status.module';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';

// RolesModule supplies PermissionEvaluatorService + StoresService required
// by RBACGuard on AdminEntityStatusController (PLATFORM-scoped entity perms).
@Module({
  imports:     [GuardsModule, StatusModule, RolesModule],
  controllers: [EntityStatusController, AdminEntityStatusController],
  providers:   [EntityStatusService, EntityStatusRepository],
  exports:     [EntityStatusService, EntityStatusRepository],
})
export class EntityStatusModule {}
