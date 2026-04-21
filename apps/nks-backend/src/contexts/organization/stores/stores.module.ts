import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresRepository } from './repositories/stores.repository';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [StoresController],
  providers: [StoresService, StoresRepository],
  exports: [StoresService, StoresRepository],
})
export class StoresModule {}
