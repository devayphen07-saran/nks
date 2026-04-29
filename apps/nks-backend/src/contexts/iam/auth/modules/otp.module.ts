import { Module } from '@nestjs/common';
import { RateLimitingModule } from '../../../../common/guards/rate-limiting.module';
import { MailModule } from '../../../../shared/mail/mail.module';

// Repositories
import { OtpRepository } from '../repositories/otp.repository';
import { OtpRateLimitRepository } from '../repositories/otp-rate-limit.repository';

// Services
import { OtpService } from '../services/otp/otp.service';
import { OtpDeliveryService } from '../services/otp/otp-delivery.service';
import { OtpRateLimitService } from '../services/otp/otp-rate-limit.service';
import { Msg91Service } from '../services/providers/msg91.service';

// Orchestrators
import { OtpAuthOrchestrator } from '../services/orchestrators/otp-auth-orchestrator.service';

/**
 * OtpModule — encapsulates all OTP (One-Time Password) functionality.
 *
 * Responsibilities:
 *   - OTP generation and validation
 *   - OTP delivery (SMS/email)
 *   - Rate limiting and abuse prevention
 *   - OTP-based authentication orchestration
 */
@Module({
  imports: [RateLimitingModule, MailModule],
  providers: [
    // Repositories
    OtpRepository,
    OtpRateLimitRepository,

    // Core OTP services
    OtpService,
    OtpDeliveryService,
    OtpRateLimitService,
    Msg91Service,

    // Orchestrators
    OtpAuthOrchestrator,
  ],
  exports: [
    OtpService,
    OtpDeliveryService,
    OtpRateLimitService,
    OtpAuthOrchestrator,
    Msg91Service,
  ],
})
export class OtpModule {}