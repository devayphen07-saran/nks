import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationRepository } from './repositories/location.repository';

@Module({
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}
