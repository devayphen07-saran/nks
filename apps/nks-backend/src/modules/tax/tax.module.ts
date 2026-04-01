import { Module } from '@nestjs/common';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { TaxRepository } from './tax.repository';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [StoreModule],
  controllers: [TaxController],
  providers: [TaxService, TaxRepository],
  exports: [TaxService, TaxRepository],
})
export class TaxModule {}
