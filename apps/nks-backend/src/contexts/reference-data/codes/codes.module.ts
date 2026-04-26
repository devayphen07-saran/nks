import { Module } from '@nestjs/common';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';
import { LookupsModule } from '../lookups/lookups.module';
import { CodesController } from './codes.controller';
import { AdminCodesController } from './admin-codes.controller';
import { CodesService } from './codes.service';

@Module({
  imports:     [GuardsModule, RolesModule, LookupsModule],
  controllers: [CodesController, AdminCodesController],
  providers:   [CodesService],
  exports:     [CodesService],
})
export class CodesModule {}
