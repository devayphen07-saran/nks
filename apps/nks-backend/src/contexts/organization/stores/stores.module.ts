import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresRepository } from './repositories/stores.repository';
import { StoreQueryService } from './store-query.service';

// GuardsModule intentionally NOT imported: StoresController relies solely on
// the global APP_GUARD (AuthGuard) registered in AppModule. No explicit
// @UseGuards() decorators appear on StoresController, so importing GuardsModule
// here was a dead import that also created a latent circular dependency
// (GuardsModule → RolesModule → StoresModule → GuardsModule).
@Module({
  imports: [],
  controllers: [StoresController],
  providers: [StoresService, StoresRepository, StoreQueryService],
  exports: [StoresService, StoresRepository, StoreQueryService],
})
export class StoresModule {}
