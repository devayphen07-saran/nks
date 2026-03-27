import { Module } from '@nestjs/common';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';
import { GeographyRepository } from './geography.repository';

@Module({
  controllers: [GeographyController],
  providers: [GeographyService, GeographyRepository],
  exports: [GeographyService],
})
export class GeographyModule {}
