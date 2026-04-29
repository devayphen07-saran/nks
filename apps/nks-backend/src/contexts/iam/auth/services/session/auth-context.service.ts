import { Injectable, Logger } from '@nestjs/common';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { SessionRevocationRepository } from '../../repositories/session-revocation.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';

/**
 * AuthContextService — the narrow surface that `AuthGuard` (in common/guards)
 * needs from the iam/auth context.
 *
 * Exists so guards never import repositories across context boundaries.
 * Keep this class focused on read/write primitives used by AuthGuard; do
 * not let it grow into a general-purpose auth service (use the existing
 * `AuthService`, `SessionService`, etc. for broader auth flows).
 *
 * See BACKEND_ARCHITECTURE.md § Module-boundary rules.
 */
@Injectable()
export class AuthContextService {
  private readonly logger = new Logger(AuthContextService.name);

  constructor(
    private readonly sessionContextRepository: SessionContextRepository,
    private readonly sessionTokenRepository: SessionTokenRepository,
    private readonly sessionRevocationRepository: SessionRevocationRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  /**
   * Single-query auth context: session + JTI check + user + roles in one round trip.
   * Replaces the previous two-round-trip flow (findByTokenWithJtiCheck → findUserById + findUserRolesForAuth).
   */
  findSessionAuthContext(token: string) {
    return this.sessionContextRepository.findSessionAuthContext(token);
  }

  /**
   * Atomically fetch the session row + a JTI revocation flag in one query.
   * Returns `{ session: null, revokedJti: false }` for unknown tokens.
   */
  findSessionByToken(token: string) {
    return this.sessionTokenRepository.findByTokenWithJtiCheck(token);
  }

  /**
   * Fetch a user record by primary key. Guards use the full row because
   * SessionMapper turns it into the SessionUser DTO.
   */
  findUserById(userId: number) {
    return this.authUsersRepository.findById(userId);
  }

  /**
   * Revoke + blocklist + delete a single session synchronously.
   * Called by AuthPolicyService for the current session when a blocked/inactive
   * account is detected — prevents immediate replay of the same token.
   * Remaining sessions are cleaned up by SessionRevocationListener off the hot path.
   */
  revokeCurrentSession(sessionId: number, reason: string, jti?: string): Promise<void> {
    return this.sessionRevocationRepository.revokeSession(sessionId, reason, jti);
  }

  /**
   * Persist a cleared activeStoreId to the session row.
   * Called by UserContextLoaderService when it detects the stored store is no
   * longer a live role assignment — prevents the stale value from surfacing again.
   */
  clearActiveStore(sessionId: number): Promise<void> {
    return this.sessionRepository.clearActiveStore(sessionId);
  }

  /**
   * Rolling session: CAS-rotate the opaque session token.
   * Returns true if rotation succeeded, false if a concurrent request already
   * rotated this token (race-safe: caller can silently ignore false).
   */
  rotateSessionToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date,
    newCsrfSecret: string,
  ): Promise<boolean> {
    return this.sessionTokenRepository.rotateToken(oldToken, newToken, newExpiresAt, newCsrfSecret);
  }

  rotateCsrfSecret(sessionId: number, newCsrfSecret: string): Promise<void> {
    return this.sessionTokenRepository.rotateCsrfSecret(sessionId, newCsrfSecret);
  }
}
