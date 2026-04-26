import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fullName } from '../../common/utils/full-name';

/**
 * MailService — email delivery abstraction.
 *
 * Currently a stub; replace the send implementations with
 * a real provider (Nodemailer/SendGrid/AWS SES) when email
 * delivery is configured.
 *
 * In production, the stub logs a critical error at startup and throws on every
 * call — this surfaces the misconfiguration immediately rather than silently
 * dropping emails and leaking OTPs into server logs.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  onModuleInit(): void {
    if (this.isProduction) {
      this.logger.error(
        'MailService is a stub — SMTP provider is not configured. ' +
        'Email delivery will fail in production. ' +
        'Replace this stub with a real provider (Nodemailer/SendGrid/AWS SES).',
      );
    }
  }

  async sendOtp(
    to: string,
    otp: string,
    recipientFirstName?: string | null,
    recipientLastName?: string | null,
  ): Promise<void> {
    if (this.isProduction) {
      throw new Error('MailService: SMTP not configured — cannot send OTP email in production');
    }
    const displayName = fullName(recipientFirstName, recipientLastName);
    this.logger.log(`[MAIL STUB] OTP email to ${displayName ?? to} — subject: "Your verification code"`);
    this.logger.debug(`[MAIL STUB] OTP value (dev only): ${otp}`);
  }
}
