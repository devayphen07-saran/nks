import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';
import { SessionEvents } from '../../../../../common/events/session.events';
import type { SessionUser } from '../../interfaces/session-user.interface';
import { AuthContextService } from '../session/auth-context.service';

/**
 * Enforces account-level access policies.
 *
 * Revocation strategy (two-phase):
 *   1. Current session revoked synchronously — prevents immediate replay of the same token.
 *   2. Remaining sessions fanned out via event — keeps P99 latency low for multi-session users.
 */
@Injectable()
export class AuthPolicyService {
  private readonly logger = new Logger(AuthPolicyService.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Throws when the account is blocked or inactive.
   *
   * Phase 1 (sync): revokes the current session so the same token cannot be
   * replayed before the response reaches the client.
   * Phase 2 (async): emits an event to clean up all other sessions for the user
   * off the hot path — avoids a full-table scan in the request lifecycle.
   */
  async enforceAccountStatus(
    sessionUser: SessionUser,
    isActive: boolean,
    currentSession: { id: number },
  ): Promise<void> {
    if (isActive && !sessionUser.isBlocked) return;

    const reason = sessionUser.isBlocked ? 'BLOCKED' : 'INACTIVE';

    try {
      await this.authContext.revokeCurrentSession(currentSession.id, reason);
      this.logger.warn(
        `Session ${currentSession.id} revoked synchronously — reason=${reason} userId=${sessionUser.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to revoke current session ${currentSession.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Async event fires unconditionally — it is the safety net. If the sync
    // revoke above failed, the async listener still sweeps all sessions for
    // this user. Suppressing it on sync failure would shrink coverage, not grow it.
    this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
      userId: sessionUser.userId,
      reason,
    });

    throw new UnauthorizedException({
      errorCode: sessionUser.isBlocked ? ErrorCode.USER_BLOCKED : ErrorCode.USER_INACTIVE,
      message: sessionUser.isBlocked ? 'Account is blocked' : 'Account is inactive',
    });
  }

}
