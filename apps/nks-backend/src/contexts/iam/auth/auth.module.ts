import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { RolesModule } from '../roles/roles.module';
import { RateLimitingModule } from '../../../common/guards/rate-limiting.module';

// Sub-modules
import { OtpModule } from './modules/otp.module';
import { SessionModule } from './modules/session.module';
import { TokenModule } from './modules/token.module';

// Repositories (non-module specific)
import { AuthUsersRepository } from './repositories/auth-users.repository';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { PermissionsChangelogRepository } from './repositories/permissions-changelog.repository';
import { DevicesRepository } from './repositories/devices.repository';

// Shared / infrastructure
import { AuthUtilsService } from './services/shared/auth-utils.service';
import { JWTConfigService } from '../../../config/jwt.config';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../../core/database/database.constants';
import * as schema from '../../../core/database/schema';

// Security
import { PasswordService } from './services/security/password.service';
import { PasswordBreachCheckService } from './services/security/password-breach-check.service';
import { KeyRotationAlertService } from './services/security/key-rotation-alert.service';
import { KeyRotationScheduler } from './services/security/key-rotation-scheduler';

// Permissions
import { PermissionsService } from './services/permissions/permissions.service';

// Guard services
import { UserContextLoaderService } from './services/guard/user-context-loader.service';
import { AuthPolicyService } from './services/guard/auth-policy.service';

// Session-layer services (live here because they need AuthUsersRepository)
import { SessionBootstrapService } from './services/session/session-bootstrap.service';
import { AuthQueryService } from './services/session/auth-query.service';
import { AuthContextService } from './services/session/auth-context.service';

// Token services (live here because they need JWTConfigService / AuthUtilsService)
import { TokenService } from './services/token/token.service';
import { OfflineTokenService } from './services/token/offline-token.service';
import { TokenLifecycleService } from './services/token/token-lifecycle.service';

// OTP services (live here because they need AuthUsersRepository / AuthProviderRepository)
import { OtpService } from './services/otp/otp.service';
import { OtpAuthOrchestrator } from './services/orchestrators/otp-auth-orchestrator.service';

// Flows / orchestrators
import { AuthFlowOrchestratorService } from './services/orchestrators/auth-flow-orchestrator.service';
import { PasswordAuthService } from './services/flows/password-auth.service';
import { AccountSecurityService } from './services/flows/account-security.service';
import { InitialRoleAssignmentService } from './services/flows/initial-role-assignment.service';
import { OnboardingService } from './services/flows/onboarding.service';
import { UserCreationService } from './services/flows/user-creation.service';

// Device registration
import { DeviceRegistrationService } from './services/device/device-registration.service';
import { DeviceRegistrationFlowService } from './services/device/device-registration-flow.service';

/**
 * AuthModule — modular auth implementation with sub-modules for OTP, Session, Token.
 *
 * Dependency direction (MUST stay acyclic):
 *   AuthModule → RolesModule → StoresModule
 *
 * CONSTRAINT: RolesModule and StoresModule must NEVER import AuthModule.
 *
 * AuditService is injected without an import because AuditModule is @Global().
 *
 * Sub-modules:
 *   - OtpModule: OTP generation, delivery, rate limiting
 *   - SessionModule: Session CRUD, token rotation, revocation
 *   - TokenModule: Token theft detection
 */
@Module({
  imports: [OtpModule, SessionModule, TokenModule, RolesModule, RateLimitingModule],
  controllers: [OtpController, AuthController],
  providers: [
    // Infrastructure & configuration
    AuthUsersRepository,
    AuthProviderRepository,
    PermissionsChangelogRepository,
    DevicesRepository,
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
    PasswordBreachCheckService,
    KeyRotationAlertService,
    KeyRotationScheduler,

    // Permissions
    PermissionsService,

    // Guard services (consumed by AuthGuard in common/guards via AuthModule exports)
    UserContextLoaderService,
    AuthPolicyService,

    // Session-layer services (need AuthUsersRepository — must live in AuthModule)
    SessionBootstrapService,
    AuthQueryService,
    AuthContextService,

    // Token services (need JWTConfigService / AuthUtilsService — must live in AuthModule)
    TokenService,
    OfflineTokenService,
    TokenLifecycleService,

    // OTP services (need AuthUsersRepository / AuthProviderRepository — must live in AuthModule)
    OtpService,
    OtpAuthOrchestrator,

    // Flows / Orchestrators
    AuthFlowOrchestratorService,
    PasswordAuthService,
    AccountSecurityService,
    InitialRoleAssignmentService,
    OnboardingService,
    UserCreationService,

    // Device registration
    DeviceRegistrationService,
    DeviceRegistrationFlowService,
  ],
  exports: [
    JWTConfigService,
    SessionModule,
    UserContextLoaderService,
    AuthPolicyService,
    AuthContextService,
    AuthQueryService,
    // UsersModule injects this for admin user management queries.
    AuthUsersRepository,
  ],
})
export class AuthModule {}
