import { AUTH_CONSTANTS } from '../../../../common/constants/app-constants';

/**
 * AccountSecurityPolicy — pure domain rules for credential security.
 *
 * No infrastructure dependencies. All methods are static so callers can use
 * them without injection, keeping test setup minimal.
 *
 * Rule ownership:
 *   shouldLock      — brute-force threshold: N failed attempts → lock
 *   isLocked        — lockout window still active
 *   isLockExpired   — lockout window elapsed (auto-unlock eligible)
 *   lockoutExpiry   — compute the absolute timestamp for a new lockout
 */
export class AccountSecurityPolicy {
  static shouldLock(failedAttempts: number): boolean {
    return failedAttempts >= AUTH_CONSTANTS.ACCOUNT_SECURITY.MAX_FAILED_LOGIN_ATTEMPTS;
  }

  static isLocked(lockedUntil: Date | null): boolean {
    return lockedUntil !== null && lockedUntil > new Date();
  }

  static isLockExpired(lockedUntil: Date | null): boolean {
    return lockedUntil !== null && lockedUntil <= new Date();
  }

  static lockoutExpiry(): Date {
    return new Date(Date.now() + AUTH_CONSTANTS.ACCOUNT_SECURITY.ACCOUNT_LOCKOUT_MS);
  }
}
