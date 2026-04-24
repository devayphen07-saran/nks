import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { AdminLookupsController } from './admin-lookups.controller';
import { LookupsService } from './lookups.service';
import { LookupsRepository } from './repositories/lookups.repository';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [LookupsController, AdminLookupsController],
  providers: [LookupsService, LookupsRepository],
  exports: [LookupsService, LookupsRepository],
})
export class LookupsModule {}
