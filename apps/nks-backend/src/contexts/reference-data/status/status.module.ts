import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { AdminStatusController } from './admin-status.controller';
import { StatusQueryService } from './status-query.service';
import { StatusCommandService } from './status-command.service';
import { StatusRepository } from './repositories/status.repository';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [StatusController, AdminStatusController],
  providers:   [StatusQueryService, StatusCommandService, StatusRepository],
  exports:     [StatusQueryService, StatusCommandService, StatusRepository],
})
export class StatusModule {}
