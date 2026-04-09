import { Module } from '@nestjs/common';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';
import { CodesRepository } from './codes.repository';

@Module({
  controllers: [CodesController],
  providers:   [CodesService, CodesRepository],
  exports:     [CodesService, CodesRepository],
})
export class CodesModule {}
