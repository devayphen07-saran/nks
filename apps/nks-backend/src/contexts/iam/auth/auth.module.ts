import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { RolesModule } from '../roles/roles.module';

// Sub-modules
import { OtpModule } from './modules/otp.module';
import { SessionModule } from './modules/session.module';
import { TokenModule } from './modules/token.module';

// Repositories (non-module specific)
import { AuthUsersRepository } from './repositories/auth-users.repository';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { PermissionsChangelogRepository } from './repositories/permissions-changelog.repository';
import { RevokedDevicesRepository } from './repositories/revoked-devices.repository';

// Shared / infrastructure
import { AuthUtilsService } from './services/shared/auth-utils.service';
import { JWTConfigService } from '../../../config/jwt.config';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../../core/database/database.constants';
import * as schema from '../../../core/database/schema';

// Security
import { PasswordService } from './services/security/password.service';
import { KeyRotationAlertService } from './services/security/key-rotation-alert.service';
import { KeyRotationScheduler } from './services/security/key-rotation-scheduler';

// Permissions
import { PermissionsService } from './services/permissions/permissions.service';

// Guard services
import { UserContextLoaderService } from './services/guard/user-context-loader.service';
import { AuthPolicyService } from './services/guard/auth-policy.service';

// Flows / orchestrators
import { AuthFlowOrchestratorService } from './services/orchestrators/auth-flow-orchestrator.service';
import { PasswordAuthService } from './services/flows/password-auth.service';
import { AccountSecurityService } from './services/flows/account-security.service';
import { InitialRoleAssignmentService } from './services/flows/initial-role-assignment.service';
import { OnboardingService } from './services/flows/onboarding.service';
import { UserCreationService } from './services/flows/user-creation.service';

// Use cases (Application layer — Controller → UseCase → Service)
import { AuthFlowUseCase } from './use-cases/auth-flow.use-case';
import { SessionManagementUseCase } from './use-cases/session-management.use-case';
import { UserOnboardingUseCase } from './use-cases/user-onboarding.use-case';
import { PermissionsQueryUseCase } from './use-cases/permissions-query.use-case';

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
 * RoutesModule is intentionally NOT imported here — routes access is handled
 * independently in AppModule.
 *
 * Sub-modules:
 *   - OtpModule: OTP generation, delivery, rate limiting
 *   - SessionModule: Session CRUD, token rotation, revocation
 *   - TokenModule: Token pair generation, JTI blocklist
 *
 * Refactoring:
 *   - Providers: 44 → ~25 (sub-modules encapsulate 20+ services)
 *   - SessionsRepository (768 lines) → 4 focused repos in SessionModule
 */
@Module({
  imports: [OtpModule, SessionModule, TokenModule, RolesModule],
  controllers: [OtpController, AuthController],
  providers: [
    // Infrastructure & configuration
    AuthUsersRepository,
    AuthProviderRepository,
    PermissionsChangelogRepository,
    RevokedDevicesRepository,
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
    KeyRotationAlertService,
    KeyRotationScheduler,

    // Permissions
    PermissionsService,

    // Guard services (consumed by AuthGuard in common/guards via AuthModule exports)
    UserContextLoaderService,
    AuthPolicyService,

    // Flows / Orchestrators
    AuthFlowOrchestratorService,
    PasswordAuthService,
    AccountSecurityService,
    InitialRoleAssignmentService,
    OnboardingService,
    UserCreationService,

    // Use cases
    AuthFlowUseCase,
    SessionManagementUseCase,
    UserOnboardingUseCase,
    PermissionsQueryUseCase,
  ],
  exports: [
    // Only export what external modules explicitly inject.
    JWTConfigService,
    // GuardsModule (common/guards) injects AuthGuard's dependencies.
    AuthContextService,
    UserContextLoaderService,
    AuthPolicyService,
    // SyncModule injects this instead of RevokedDevicesRepository directly,
    // so the repository layer stays inside iam/auth.
    DeviceRevocationQueryService,
    // UsersModule injects this for admin user management queries.
    AuthUsersRepository,
  ],
})
export class AuthModule {}
