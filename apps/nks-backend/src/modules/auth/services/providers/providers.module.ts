import { Module } from '@nestjs/common';
import { Msg91Service } from './msg91.service';

/**
 * ProvidersModule — third-party communication provider integrations.
 */
@Module({
  providers: [Msg91Service],
  exports: [Msg91Service],
})
export class ProvidersModule {}
