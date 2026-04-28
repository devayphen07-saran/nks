import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';
import { SessionEvents } from '../../../../../common/events/session.events';
import type { SessionUser } from '../../interfaces/session-user.interface';
import { AuthContextService } from '../session/auth-context.service';

/**
 * Enforces account-level and network-level access policies.
 *
 * Responsibilities:
 *   - Blocked / inactive account enforcement with session revocation
 *   - IP change detection (soft fraud signal — logs only, never rejects)
 *
 * Revocation strategy (two-phase):
 *   1. Current session revoked synchronously — prevents immediate replay of the same token.
 *   2. Remaining sessions fanned out via event — keeps P99 latency low for multi-session users.
 */
@Injectable()
export class AuthPolicyService {
  private readonly logger = new Logger(AuthPolicyService.name);
  private readonly ipHmacSecret: string;

  constructor(
    private readonly authContext: AuthContextService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

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
    currentSession: { id: number; jti?: string | null },
  ): Promise<void> {
    if (isActive && !sessionUser.isBlocked) return;

    const reason = sessionUser.isBlocked ? 'BLOCKED' : 'INACTIVE';

    try {
      await this.authContext.revokeCurrentSession(
        currentSession.id,
        reason,
        currentSession.jti ?? undefined,
      );
      this.logger.warn(
        `Session ${currentSession.id} revoked synchronously — reason=${reason} userId=${sessionUser.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to revoke current session ${currentSession.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
      userId: sessionUser.userId,
      reason,
    });

    throw new UnauthorizedException({
      errorCode: sessionUser.isBlocked ? ErrorCode.USER_BLOCKED : ErrorCode.USER_INACTIVE,
      message: sessionUser.isBlocked ? 'Account is blocked' : 'Account is inactive',
    });
  }

  /**
   * Enforces device binding for Bearer (mobile) sessions.
   *
   * A session created on a specific device (deviceId stored at login) must not
   * be accepted from a different device — mitigates session token theft where the
   * attacker has the token but not the bound device ID.
   *
   * Policy: hard-reject (throws 401). Unlike IP changes (which are log-only),
   * a device mismatch on a device-bound session is not a legitimate scenario.
   *
   * No-op when:
   *   - `sessionDeviceId` is null (session was not device-bound — older sessions)
   *   - `requestDeviceId` is null (client didn't send X-Device-Id — backward compat)
   */
  enforceDeviceBinding(
    sessionDeviceId: string | null | undefined,
    requestDeviceId: string | null,
  ): void {
    if (!sessionDeviceId || !requestDeviceId) return;

    if (requestDeviceId !== sessionDeviceId) {
      this.logger.warn('Device mismatch on bearer session — possible token theft');
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'Device changed — please re-authenticate.',
      });
    }
  }

  /**
   * Checks whether the request IP matches the session's recorded IP fingerprint.
   *
   * Policy: log-only (never rejects). Mobile clients legitimately roam across
   * IPs (Wi-Fi ↔ LTE); hard-rejecting on IP change would break them.
   * Repeated mismatches are a fraud signal and can be acted on separately
   * (e.g. step-up auth, rate-limiting) by observing the log stream.
   *
   * IP source: `clientIp` must be pre-extracted from `req.ip`, which Express
   * resolves correctly from `X-Forwarded-For` when `app.set('trust proxy', n)`
   * is configured (see main.ts). Always pass `req.ip ?? req.socket?.remoteAddress ?? ''`.
   *
   * No-op when `ipHash` is null (pre-feature sessions) or `clientIp` is empty
   * (direct connections with trust proxy misconfigured — safe to skip rather than
   * risk false positives).
   */
  detectIpChange(ipHash: string | null | undefined, clientIp: string): void {
    if (!ipHash || !clientIp) return;

    const currentHash = crypto
      .createHmac('sha256', this.ipHmacSecret)
      .update(clientIp)
      .digest('hex');

    if (currentHash !== ipHash) {
      this.logger.warn({
        msg: 'IP change detected',
        hint: 'May be a network switch (Wi-Fi↔LTE) or a routing change; investigate repeated occurrences.',
      });
    }
  }
}
