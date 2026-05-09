import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { fullName } from '../../common/utils/full-name';

/**
 * MailService — email delivery abstraction.
 *
 * Currently a stub; replace the send implementations with a real provider
 * (Nodemailer/SendGrid/AWS SES) when email delivery is configured.
 *
 * Boot guard: in production the constructor throws immediately, failing
 * NestFactory.create() before the app starts listening. A misconfigured
 * deploy never gets the chance to drop OTP emails into server logs at
 * first send — readiness probe fails, k8s rolls back.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction: boolean;

  constructor(appConfig: AppConfigService) {
    this.isProduction = appConfig.isProduction;
    if (this.isProduction) {
      throw new Error(
        'MailService stub cannot run in production — wire a real SMTP provider ' +
        '(Nodemailer/SendGrid/AWS SES) before deploying. Refusing to start.',
      );
    }
  }

  onModuleInit(): void {
    this.logger.warn('[MAIL STUB] Email delivery is stubbed — OTP values will be logged at debug level. Dev only.');
  }

  async sendOtp(
    to: string,
    otp: string,
    recipientFirstName?: string | null,
    recipientLastName?: string | null,
  ): Promise<void> {
    const displayName = fullName(recipientFirstName, recipientLastName);
    this.logger.log(`[MAIL STUB] OTP email to ${displayName ?? to} — subject: "Your verification code"`);
    this.logger.debug(`[MAIL STUB] OTP value (dev only): ${otp}`);
  }
}
