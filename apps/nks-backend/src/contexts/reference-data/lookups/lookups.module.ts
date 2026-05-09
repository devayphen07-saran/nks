import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { AdminLookupsController } from './admin-lookups.controller';
import { LookupsQueryService } from './lookups-query.service';
import { LookupsCommandService } from './lookups-command.service';
import { LookupsRepository } from './repositories/lookups.repository';
import { LookupsSyncService } from './lookups-sync.service';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [LookupsController, AdminLookupsController],
  providers: [LookupsQueryService, LookupsCommandService, LookupsRepository, LookupsSyncService],
  exports: [LookupsQueryService, LookupsCommandService, LookupsRepository],
})
export class LookupsModule {}
