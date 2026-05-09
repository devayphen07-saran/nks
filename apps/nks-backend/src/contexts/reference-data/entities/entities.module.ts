import { Module } from '@nestjs/common';
import { EntityRegistryService } from './entity-registry.service';

@Module({
  providers: [EntityRegistryService],
  exports:   [EntityRegistryService],
})
export class EntitiesModule {}
