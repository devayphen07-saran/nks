import { Module } from '@nestjs/common';
import { CsrfService } from '../../../../common/csrf.service';

// Focused repositories
import { SessionRepository } from '../repositories/session.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { SessionRevocationRepository } from '../repositories/session-revocation.repository';
import { SessionContextRepository } from '../repositories/session-context.repository';

// Services
import { AuthCommandService } from '../services/session/auth-command.service';
import { AuthQueryService } from '../services/session/auth-query.service';
import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';
import { SessionBootstrapService } from '../services/session/session-bootstrap.service';
import { SessionCleanupService } from '../services/session/session-cleanup.service';
import { AuthContextService } from '../services/session/auth-context.service';
import { DeviceRevocationQueryService } from '../services/session/device-revocation-query.service';
import { SessionRotationPolicy } from '../services/session/session-rotation-policy.service';

// Listeners
import { SessionRevocationListener } from '../listeners/session-revocation.listener';

/**
 * SessionModule — encapsulates all session-related data access and business logic.
 *
 * Replaced:
 *   - SessionsRepository (768 lines) → 4 focused repositories:
 *     - SessionRepository (CRUD)
 *     - SessionTokenRepository (token lifecycle)
 *     - SessionRevocationRepository (revocation)
 *     - SessionContextRepository (auth context + cleanup)
 */
@Module({
  providers: [
    // Focused repositories
    SessionRepository,
    SessionTokenRepository,
    SessionRevocationRepository,
    SessionContextRepository,

    // Infrastructure
    CsrfService,

    // Services
    SessionRotationPolicy,
    SessionCommandService,
    SessionQueryService,
    SessionBootstrapService,
    SessionCleanupService,
    AuthContextService,
    AuthCommandService,
    AuthQueryService,
    DeviceRevocationQueryService,

    // Listeners
    SessionRevocationListener,
  ],
  exports: [
    // Repositories exported for internal use
    SessionRepository,
    SessionTokenRepository,
    SessionRevocationRepository,
    SessionContextRepository,

    // Services exported for other modules
    AuthContextService,
    DeviceRevocationQueryService,
    SessionCommandService,
    SessionQueryService,
    AuthCommandService,
    AuthQueryService,
  ],
})
export class SessionModule {}