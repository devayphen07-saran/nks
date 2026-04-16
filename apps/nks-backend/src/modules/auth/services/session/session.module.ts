import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth-core.module';
import { AuthPermissionsModule } from '../permissions/permissions.module';
import { AuthTokenModule } from '../token/token.module';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionCleanupService } from './session-cleanup.service';

/**
 * AuthSessionModule — session lifecycle: creation, validation, cleanup.
 */
@Module({
  imports: [AuthCoreModule, AuthPermissionsModule, AuthTokenModule],
  providers: [AuthService, SessionService, SessionCleanupService],
  exports: [AuthService, SessionService, SessionCleanupService],
})
export class AuthSessionModule {}
