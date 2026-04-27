import { Module } from '@nestjs/common';
import { EntityStatusController } from './entity-status.controller';
import { AdminEntityStatusController } from './admin-entity-status.controller';
import { EntityStatusQueryService } from './entity-status-query.service';
import { EntityStatusCommandService } from './entity-status-command.service';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { StatusModule } from '../status/status.module';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';

@Module({
  imports:     [GuardsModule, StatusModule, RolesModule],
  controllers: [EntityStatusController, AdminEntityStatusController],
  providers:   [EntityStatusQueryService, EntityStatusCommandService, EntityStatusRepository],
  exports:     [EntityStatusQueryService, EntityStatusCommandService, EntityStatusRepository],
})
export class EntityStatusModule {}
