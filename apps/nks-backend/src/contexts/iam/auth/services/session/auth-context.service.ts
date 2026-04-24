import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../../repositories/sessions.repository';
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
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  /**
   * Atomically fetch the session row + a JTI revocation flag in one query.
   * Returns `{ session: null, revokedJti: false }` for unknown tokens.
   */
  findSessionByToken(token: string) {
    return this.sessionsRepository.findByTokenWithJtiCheck(token);
  }

  /**
   * Fetch a user record by primary key. Guards use the full row because
   * SessionMapper turns it into the SessionUser DTO.
   */
  findUserById(userId: number) {
    return this.authUsersRepository.findById(userId);
  }

  /**
   * Invalidate every session for a user — called when AuthGuard detects a
   * blocked account. Returns the number of rows deleted (unused by the
   * guard, but surfaced for callers that want to log/audit).
   */
  deleteAllSessionsForUser(userId: number): Promise<number> {
    return this.sessionsRepository.deleteAllForUser(userId);
  }

  /**
   * Throttled heartbeat write. Callers should decide when to invoke it
   * (AuthGuard gates it to once every LAST_ACTIVE_THROTTLE_MS).
   */
  touchUserLastActive(userId: number): Promise<void> {
    return this.authUsersRepository.touchLastActiveAt(userId);
  }

  /**
   * Persist a cleared activeStoreId to the session row.
   * Called by AuthGuard when it detects the stored store is no longer
   * a live role assignment — prevents the stale value from surfacing again.
   */
  clearActiveStore(sessionId: number): Promise<void> {
    return this.sessionsRepository.clearActiveStore(sessionId);
  }
}
