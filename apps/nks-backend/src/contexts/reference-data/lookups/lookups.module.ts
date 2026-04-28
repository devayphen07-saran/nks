import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { AdminLookupsController } from './admin-lookups.controller';
import { LookupsQueryService } from './lookups-query.service';
import { LookupsCommandService } from './lookups-command.service';
import { LookupValidatorService } from './lookup-validator.service';
import { LookupsRepository } from './repositories/lookups.repository';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [LookupsController, AdminLookupsController],
  providers: [LookupsQueryService, LookupsCommandService, LookupValidatorService, LookupsRepository],
  exports: [LookupsQueryService, LookupsCommandService, LookupValidatorService, LookupsRepository],
})
export class LookupsModule {}
