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
   * Revoke + blocklist + delete every session for a user.
   * Called when AuthGuard detects a blocked or inactive account.
   * JTIs are blocklisted so outstanding access tokens cannot survive their 15-min TTL.
   */
  async revokeAndDeleteAllSessionsForUser(userId: number, reason: string): Promise<void> {
    const jtis = await this.sessionsRepository.findJtisByUserId(userId);
    await this.sessionsRepository.revokeAndDeleteAllForUser(userId, reason, jtis);
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
