import { Module } from '@nestjs/common';
import { RateLimitingModule } from '../../../../common/guards/rate-limiting.module';
import { MailModule } from '../../../../shared/mail/mail.module';

// Repositories
import { OtpRepository } from '../repositories/otp.repository';
import { OtpRateLimitRepository } from '../repositories/otp-rate-limit.repository';

// Services
import { OtpDeliveryService } from '../services/otp/otp-delivery.service';
import { OtpRateLimitService } from '../services/otp/otp-rate-limit.service';
import { Msg91Service } from '../services/providers/msg91.service';

/**
 * OtpModule — pure OTP infrastructure: delivery, rate limiting, repositories.
 *
 * Services that need cross-cutting auth providers (AuthUsersRepository,
 * AuthProviderRepository, UserCreationService, AuthFlowOrchestratorService)
 * live in AuthModule to avoid a circular dependency.
 *
 * Moved to AuthModule: OtpService, OtpAuthOrchestrator.
 */
@Module({
  imports: [RateLimitingModule, MailModule],
  providers: [
    OtpRepository,
    OtpRateLimitRepository,
    OtpDeliveryService,
    OtpRateLimitService,
    Msg91Service,
  ],
  exports: [
    OtpRepository,
    OtpRateLimitRepository,
    OtpDeliveryService,
    OtpRateLimitService,
    Msg91Service,
  ],
})
export class OtpModule {}
