import { Module } from '@nestjs/common';
import { CsrfService } from '../../../../common/csrf.service';

// Focused repositories
import { SessionRepository } from '../repositories/session.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { SessionRevocationRepository } from '../repositories/session-revocation.repository';
import { SessionContextRepository } from '../repositories/session-context.repository';
import { RevokedDevicesRepository } from '../repositories/revoked-devices.repository';

// Services
import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';
import { SessionCleanupService } from '../services/session/session-cleanup.service';
import { DeviceRevocationQueryService } from '../services/session/device-revocation-query.service';
import { SessionRotationPolicy } from '../services/session/session-rotation-policy.service';

// Listeners
import { SessionRevocationListener } from '../listeners/session-revocation.listener';

/**
 * SessionModule — pure session infrastructure: repositories, CRUD, cleanup.
 *
 * Auth-layer services that need AuthUsersRepository/PermissionsService
 * (SessionBootstrapService, AuthContextService, AuthCommandService, AuthQueryService)
 * live in AuthModule to avoid a circular dependency
 * (AuthModule → SessionModule, SessionModule ↛ AuthModule).
 */
@Module({
  providers: [
    // Focused repositories
    SessionRepository,
    SessionTokenRepository,
    SessionRevocationRepository,
    SessionContextRepository,
    RevokedDevicesRepository,

    // Infrastructure
    CsrfService,

    // Services
    SessionRotationPolicy,
    SessionCommandService,
    SessionQueryService,
    SessionCleanupService,
    DeviceRevocationQueryService,

    // Listeners
    SessionRevocationListener,
  ],
  exports: [
    // Repositories exported for AuthModule and its providers
    SessionRepository,
    SessionTokenRepository,
    SessionRevocationRepository,
    SessionContextRepository,
    RevokedDevicesRepository,

    // Services exported for AuthModule and external consumers
    SessionCommandService,
    SessionQueryService,
    DeviceRevocationQueryService,
  ],
})
export class SessionModule {}
