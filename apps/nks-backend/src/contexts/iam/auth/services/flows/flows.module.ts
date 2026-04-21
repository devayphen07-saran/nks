import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth-core.module';
import { SecurityModule } from '../security/security.module';
import { OtpModule } from '../otp/otp.module';
import { AuthSessionModule } from '../session/session.module';
import { AuthTokenModule } from '../token/token.module';
import { AuthPermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../../../roles/roles.module';
import { AuthFlowOrchestrator } from '../orchestrators/auth-flow-orchestrator.service';
import { OtpAuthOrchestrator } from '../orchestrators/otp-auth-orchestrator.service';
import { PasswordAuthService } from './password-auth.service';
import { OnboardingService } from './onboarding.service';
import { UserCreationService } from './user-creation.service';

/**
 * AuthFlowsModule — high-level auth flows orchestrating lower-level submodules.
 * Covers: registration, login (password + OTP), onboarding, user creation.
 */
@Module({
  imports: [
    AuthCoreModule,
    SecurityModule,
    OtpModule,
    AuthSessionModule,
    AuthTokenModule,
    AuthPermissionsModule,
    RolesModule,
  ],
  providers: [
    AuthFlowOrchestrator,
    OtpAuthOrchestrator,
    PasswordAuthService,
    OnboardingService,
    UserCreationService,
  ],
  exports: [
    AuthFlowOrchestrator,
    OtpAuthOrchestrator,
    PasswordAuthService,
    OnboardingService,
    UserCreationService,
  ],
})
export class AuthFlowsModule {}
