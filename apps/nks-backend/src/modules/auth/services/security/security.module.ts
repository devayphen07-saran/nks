import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { RefreshTokenService } from '../session/refresh-token.service';

/**
 * SecurityModule — stateless cryptographic utilities.
 * No external auth dependencies; safe to import anywhere.
 */
@Module({
  providers: [PasswordService, RefreshTokenService],
  exports: [PasswordService, RefreshTokenService],
})
export class SecurityModule {}
