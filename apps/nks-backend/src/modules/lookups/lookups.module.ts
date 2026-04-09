import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { LookupsService } from './lookups.service';
import { LookupsRepository } from './lookups.repository';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RolesModule],
  controllers: [LookupsController],
  providers: [LookupsService, LookupsRepository],
  exports: [LookupsService, LookupsRepository],
})
export class LookupsModule {}
