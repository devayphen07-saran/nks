import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth-core.module';
import { ProvidersModule } from '../providers/providers.module';
import { OtpService } from './otp.service';
import { OtpRateLimitService } from './otp-rate-limit.service';

/**
 * OtpModule — OTP generation, delivery, and rate limiting.
 */
@Module({
  imports: [AuthCoreModule, ProvidersModule],
  providers: [OtpService, OtpRateLimitService],
  exports: [OtpService, OtpRateLimitService],
})
export class OtpModule {}
