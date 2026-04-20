import { Global, Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresRepository } from './repositories/stores.repository';

@Global()
@Module({
  controllers: [StoresController],
  providers: [StoresService, StoresRepository],
  exports: [StoresService, StoresRepository],
})
export class StoresModule {}
