import { Injectable, Logger } from '@nestjs/common';

/**
 * MailService — email delivery abstraction.
 *
 * Currently a stub; replace the `send()` implementation with
 * a real provider (Nodemailer/SendGrid/AWS SES) when email
 * delivery is configured.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendOtp(to: string, otp: string): Promise<void> {
    this.logger.log(`[MAIL STUB] OTP email to ${to} — subject: "Your verification code"`);
    this.logger.debug(`[MAIL STUB] OTP value (dev only): ${otp}`);
  }
}
