import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreAddressService } from './services/store-address.service';
import { StoreController } from './store.controller';
import { StoreRepository } from './store.repository';
import { RolesModule } from '../roles/roles.module';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [RolesModule, RoutesModule],
  controllers: [StoreController],
  providers: [StoreService, StoreAddressService, StoreRepository],
  exports: [StoreService, StoreAddressService],
})
export class StoreModule {}
