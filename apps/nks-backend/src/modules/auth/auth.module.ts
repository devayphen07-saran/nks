import { Global, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { Msg91Service } from './services/msg91.service';
import { PasswordService } from './services/password.service';
import { OtpRateLimitService } from './services/otp-rate-limit.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { PermissionsService } from './services/permissions.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { SessionsRepository } from './repositories/sessions.repository';
import { AuthUsersRepository } from './repositories/auth-users.repository';
import { OtpRepository } from './repositories/otp.repository';
import { OtpRateLimitRepository } from './repositories/otp-rate-limit.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { SessionCleanupRepository } from './repositories/session-cleanup.repository';
import { RolesModule } from '../roles/roles.module';
import { RoutesModule } from '../routes/routes.module';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../core/database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { JWTConfigService } from '../../config/jwt.config';

@Global()
@Module({
  imports: [RolesModule, RoutesModule],
  controllers: [OtpController, AuthController],
  providers: [
    // Core auth services
    AuthService,
    OtpService,
    PasswordService,
    PermissionsService,

    // New refactored services
    SessionService,
    TokenService,

    // Repositories
    SessionsRepository,
    AuthUsersRepository,
    OtpRepository,
    OtpRateLimitRepository,
    RefreshTokenRepository,
    AuthProviderRepository,
    SessionCleanupRepository,

    // Supporting services
    Msg91Service,
    OtpRateLimitService,
    SessionCleanupService,
    RefreshTokenService,
    JWTConfigService,

    // BetterAuth factory
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: NodePgDatabase<typeof schema>) => getAuth(db),
    },
  ],
  exports: [
    // Core auth services
    AuthService,
    OtpService,
    PasswordService,
    PermissionsService,

    // New refactored services
    SessionService,
    TokenService,

    // Repositories
    SessionsRepository,
    AuthUsersRepository,
    OtpRepository,
    OtpRateLimitRepository,
    RefreshTokenRepository,
    AuthProviderRepository,
    SessionCleanupRepository,

    // Supporting services
    OtpRateLimitService,
    SessionCleanupService,
    RefreshTokenService,
    JWTConfigService,

    // BetterAuth
    BETTER_AUTH_TOKEN,
  ],
})
export class AuthModule {}
