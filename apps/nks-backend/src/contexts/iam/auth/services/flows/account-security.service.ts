import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { SessionEvents } from '../../../../../common/events/session.events';
import { AccountSecurityPolicy } from '../../domain/account-security.policy';
import { PasswordAuthValidator } from '../../validators';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

type AuthUser = NonNullable<
  Awaited<ReturnType<AuthUsersRepository['findByEmail']>>
>;
type AuditMeta = { deviceId?: string; deviceType?: string };

/**
 * AccountSecurityService — manages account lockouts, brute-force protection, and auto-unlock.
 *
 * Extracted from PasswordAuthService to own:
 *   - Account lockout state checks
 *   - Brute-force detection and account locking
 *   - Auto-unlock on lockout expiry
 *   - Audit logging for security events
 *   - Session revocation on account lock
 *
 * Dependencies (3):
 *   - authUsersRepository (lockout updates, failed attempt tracking)
 *   - auditService (security event logging)
 *   - eventEmitter (session revocation on lockout)
 */
@Injectable()
export class AccountSecurityService {
  private readonly logger = new Logger(AccountSecurityService.name);

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly auditService: AuditCommandService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check if account is permanently blocked (administrative block, not lockout).
   * Logs a warning if blocked and throws UnauthorizedException.
   */
  checkBlockStatus(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): void {
    if (!user.isBlocked) return;
    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'Login attempt - account is blocked',
      severity: 'warning',
    });
    PasswordAuthValidator.assertNotBlocked(user);
  }

  /**
   * Handle account lockout state on login attempt.
   * If locked and unexpired, throw UnauthorizedException.
   * If lock expired, auto-unlock and log the event.
   */
  async handleLockoutState(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): Promise<void> {
    if (!user.accountLockedUntil) return;

    if (AccountSecurityPolicy.isLocked(user.accountLockedUntil)) {
      this.auditService.log({
        ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
        description: 'Login attempt - account locked (brute-force)',
        severity: 'warning',
      });
      PasswordAuthValidator.assertNotLocked(user);
    } else {
      // Lock expired — CAS-safe auto-unlock: WHERE accountLockedUntil IS NOT NULL AND <= NOW()
      await this.authUsersRepository.autoUnlockIfExpired(user.id);
      this.auditService.log({
        ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
        action: 'ACCOUNT_UNBLOCKED',
        description: 'Account lockout expired — auto-unlocked on login attempt',
        severity: 'info',
      });
      this.logger.debug(`Auto-unlocked account for user ${user.id}`);
    }
  }

  /**
   * Handle failed password attempt: increment failed count, lock if threshold reached.
   * On lock, revoke all existing sessions and emit audit event.
   */
  async handleFailedPassword(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): Promise<void> {
    const newFailedCount = await this.authUsersRepository.incrementFailedAttempts(user.id);
    const shouldLock = AccountSecurityPolicy.shouldLock(newFailedCount);

    if (shouldLock) {
      await this.authUsersRepository.lockAccount(
        user.id,
        AccountSecurityPolicy.lockoutExpiry(),
      );
      // Revoke existing sessions off the hot path — the lockout is already
      // committed, so new logins are blocked before the listener fires.
      this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
        userId: user.id,
        reason: 'ACCOUNT_LOCKED',
      });
    }

    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'Login attempt - invalid password',
      severity: 'warning',
      metadata: {
        ...auditMeta,
        failedAttempts: newFailedCount,
        accountLocked: shouldLock,
      },
    });
    PasswordAuthValidator.assertPasswordValid(false);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private loginAuditBase(
    userId: number,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ) {
    return {
      action: 'LOGIN' as const,
      userId,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: auditMeta,
      resourceType: 'user' as const,
      resourceId: userId,
    };
  }
}
