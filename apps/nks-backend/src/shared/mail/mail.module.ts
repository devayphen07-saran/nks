import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * MailModule — email delivery (NOT global — consumers must import explicitly).
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
