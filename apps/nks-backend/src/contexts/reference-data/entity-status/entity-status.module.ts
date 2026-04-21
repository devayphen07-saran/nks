import { Module } from '@nestjs/common';
import { EntityStatusController } from './entity-status.controller';
import { EntityStatusService } from './entity-status.service';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { StatusModule } from '../status/status.module';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports:     [GuardsModule, StatusModule, RolesModule],
  controllers: [EntityStatusController],
  providers:   [EntityStatusService, EntityStatusRepository],
  exports:     [EntityStatusService, EntityStatusRepository],
})
export class EntityStatusModule {}
