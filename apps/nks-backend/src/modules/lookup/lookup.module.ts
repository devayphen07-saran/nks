import { Module } from '@nestjs/common';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';
import { LookupRepository } from './lookup.repository';

@Module({
  controllers: [LookupController],
  providers: [LookupService, LookupRepository],
  exports: [LookupService],
})
export class LookupModule {}
