import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';
import { CodesRepository } from './codes.repository';

@Module({
  imports:     [RolesModule],
  controllers: [CodesController],
  providers:   [CodesService, CodesRepository],
  exports:     [CodesService, CodesRepository],
})
export class CodesModule {}
