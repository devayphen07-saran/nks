import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { AdminStatusController } from './admin-status.controller';
import { StatusService } from './status.service';
import { StatusRepository } from './repositories/status.repository';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [StatusController, AdminStatusController],
  providers:   [StatusService, StatusRepository],
  exports:     [StatusService, StatusRepository],
})
export class StatusModule {}
