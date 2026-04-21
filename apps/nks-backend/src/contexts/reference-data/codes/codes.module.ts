import { Module } from '@nestjs/common';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';
import { CodesRepository } from './repositories/codes.repository';

@Module({
  imports:     [GuardsModule, RolesModule],
  controllers: [CodesController],
  providers:   [CodesService, CodesRepository],
  exports:     [CodesService, CodesRepository],
})
export class CodesModule {}
