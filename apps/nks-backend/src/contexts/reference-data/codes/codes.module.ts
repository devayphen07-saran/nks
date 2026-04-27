import { Module } from '@nestjs/common';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';
import { LookupsModule } from '../lookups/lookups.module';
import { CodesController } from './codes.controller';
import { AdminCodesController } from './admin-codes.controller';
import { CodesQueryService } from './codes-query.service';
import { CodesCommandService } from './codes-command.service';

@Module({
  imports:     [GuardsModule, RolesModule, LookupsModule],
  controllers: [CodesController, AdminCodesController],
  providers:   [CodesQueryService, CodesCommandService],
  exports:     [CodesQueryService, CodesCommandService],
})
export class CodesModule {}
