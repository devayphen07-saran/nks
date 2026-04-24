import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { RolesModule } from '../roles/roles.module';
import { RateLimitingModule } from '../../../common/guards/rate-limiting.module';
import { MailModule } from '../../../shared/mail/mail.module';

// Repositories
import { SessionsRepository } from './repositories/sessions.repository';
import { AuthUsersRepository } from './repositories/auth-users.repository';
import { OtpRepository } from './repositories/otp.repository';
import { OtpRateLimitRepository } from './repositories/otp-rate-limit.repository';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { SessionCleanupRepository } from './repositories/session-cleanup.repository';
import { PermissionsChangelogRepository } from './repositories/permissions-changelog.repository';
import { RevokedDevicesRepository } from './repositories/revoked-devices.repository';
import { JtiBlocklistRepository } from './repositories/jti-blocklist.repository';

// Shared / infrastructure
import { AuthUtilsService } from './services/shared/auth-utils.service';
import { JWTConfigService } from '../../../config/jwt.config';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../../core/database/database.constants';
import * as schema from '../../../core/database/schema';

// Security
import { PasswordService } from './services/security/password.service';
import { RefreshTokenService } from './services/session/refresh-token.service';
import { KeyRotationAlertService } from './services/security/key-rotation-alert.service';
import { KeyRotationScheduler } from './services/security/key-rotation-scheduler';

// Providers
import { Msg91Service } from './services/providers/msg91.service';

// Permissions
import { PermissionsService } from './services/permissions/permissions.service';

// OTP
import { OtpService } from './services/otp/otp.service';
import { OtpRateLimitService } from './services/otp/otp-rate-limit.service';

// Token
import { TokenService } from './services/token/token.service';
import { TokenLifecycleService } from './services/token/token-lifecycle.service';
import { JtiBlocklistService } from './services/token/jti-blocklist.service';

// Session
import { AuthService } from './services/session/auth.service';
import { SessionService } from './services/session/session.service';
import { SessionCleanupService } from './services/session/session-cleanup.service';
import { AuthContextService } from './services/session/auth-context.service';
import { DeviceRevocationQueryService } from './services/session/device-revocation-query.service';

// Flows / orchestrators
import { AuthFlowOrchestrator } from './services/orchestrators/auth-flow-orchestrator.service';
import { OtpAuthOrchestrator } from './services/orchestrators/otp-auth-orchestrator.service';
import { PasswordAuthService } from './services/flows/password-auth.service';
import { OnboardingService } from './services/flows/onboarding.service';
import { UserCreationService } from './services/flows/user-creation.service';

/**
 * AuthModule — flat, single-module auth implementation.
 *
 * Dependency direction (MUST stay acyclic):
 *   AuthModule → RolesModule → StoresModule
 *
 * CONSTRAINT: RolesModule and StoresModule must NEVER import AuthModule.
 *
 * AuditService is injected without an import because AuditModule is @Global().
 *
 * RoutesModule is intentionally NOT imported here — routes access is handled
 * independently in AppModule.
 */
@Module({
  imports: [RateLimitingModule, RolesModule, MailModule],
  controllers: [OtpController, AuthController],
  providers: [
    // Infrastructure
    SessionsRepository,
    AuthUsersRepository,
    OtpRepository,
    OtpRateLimitRepository,
    AuthProviderRepository,
    SessionCleanupRepository,
    PermissionsChangelogRepository,
    RevokedDevicesRepository,
    JtiBlocklistRepository,
    AuthUtilsService,
    JWTConfigService,
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [DATABASE_TOKEN, ConfigService],
      useFactory: (db: NodePgDatabase<typeof schema>, config: ConfigService) =>
        getAuth(db, {
          baseUrl: config.getOrThrow<string>('BETTER_AUTH_BASE_URL'),
          secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
          googleClientId: config.get<string>('GOOGLE_CLIENT_ID'),
          googleClientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
        }),
    },

    // Security
    PasswordService,
    RefreshTokenService,
    KeyRotationAlertService,
    KeyRotationScheduler,

    // Providers
    Msg91Service,

    // Permissions
    PermissionsService,

    // OTP
    OtpService,
    OtpRateLimitService,

    // Token
    TokenService,
    TokenLifecycleService,
    JtiBlocklistService,

    // Session
    AuthService,
    SessionService,
    SessionCleanupService,
    AuthContextService,
    DeviceRevocationQueryService,

    // Flows
    AuthFlowOrchestrator,
    OtpAuthOrchestrator,
    PasswordAuthService,
    OnboardingService,
    UserCreationService,
  ],
  exports: [
    // Only export what external modules explicitly inject.
    JWTConfigService,
    // GuardsModule (common/guards) injects this instead of reaching into
    // SessionsRepository / AuthUsersRepository directly from AuthGuard.
    AuthContextService,
    // SyncModule injects this instead of RevokedDevicesRepository directly,
    // so the repository layer stays inside iam/auth.
    DeviceRevocationQueryService,
  ],
})
export class AuthModule {}
