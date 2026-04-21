import { Module } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SessionsRepository } from './repositories/sessions.repository';
import { AuthUsersRepository } from './repositories/auth-users.repository';
import { OtpRepository } from './repositories/otp.repository';
import { OtpRateLimitRepository } from './repositories/otp-rate-limit.repository';
import { AuthProviderRepository } from './repositories/auth-provider.repository';
import { SessionCleanupRepository } from './repositories/session-cleanup.repository';
import { PermissionsChangelogRepository } from './repositories/permissions-changelog.repository';
import { RevokedDevicesRepository } from './repositories/revoked-devices.repository';
import { AuthUtilsService } from './services/shared/auth-utils.service';
import { JWTConfigService } from '../../../config/jwt.config';
import { RolesModule } from '../roles/roles.module';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../../core/database/database.constants';
import * as schema from '../../../core/database/schema';

/**
 * AuthCoreModule — shared infrastructure for all auth submodules.
 *
 * Provides: all auth repositories, JWTConfigService, BetterAuth instance,
 * and AuthUtilsService (shared role cache, hashRoles, getBetterAuthContext).
 * Every other auth submodule imports this to access these shared providers.
 */
@Module({
  imports: [RolesModule],
  providers: [
    SessionsRepository,
    AuthUsersRepository,
    OtpRepository,
    OtpRateLimitRepository,
    AuthProviderRepository,
    SessionCleanupRepository,
    PermissionsChangelogRepository,
    RevokedDevicesRepository,
    AuthUtilsService,
    JWTConfigService,
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: NodePgDatabase<typeof schema>) => getAuth(db),
    },
  ],
  exports: [
    SessionsRepository,
    AuthUsersRepository,
    OtpRepository,
    OtpRateLimitRepository,
    AuthProviderRepository,
    SessionCleanupRepository,
    PermissionsChangelogRepository,
    RevokedDevicesRepository,
    AuthUtilsService,
    JWTConfigService,
    BETTER_AUTH_TOKEN,
  ],
})
export class AuthCoreModule {}
