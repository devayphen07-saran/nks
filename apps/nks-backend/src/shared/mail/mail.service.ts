import { Injectable, Logger } from '@nestjs/common';
import { fullName } from '../../common/utils/full-name';

/**
 * MailService — email delivery abstraction.
 *
 * Currently a stub; replace the send implementations with
 * a real provider (Nodemailer/SendGrid/AWS SES) when email
 * delivery is configured.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

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
