/**
 * Rate Limiter Utility
 * Prevents brute force and abuse attacks on OTP operations
 * ✅ CRITICAL FIX #5: Client-side rate limiting to complement server-side limits
 */

export interface RateLimitConfig {
  /** Maximum number of attempts allowed */
  maxAttempts: number;
  /** Time window in milliseconds to count attempts */
  timeWindowMs: number;
  /** Minimum delay between attempts in milliseconds */
  minDelayBetweenAttemptsMs?: number;
  /** Custom message to show when rate limited */
  customMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  secondsUntilReset: number;
  message?: string;
}

/**
 * Simple rate limiter using token bucket algorithm
 * Tracks attempts and enforces time-based limits
 */
export class RateLimiter {
  private attempts: number = 0;
  private firstAttemptTime: number = 0;
  private lastAttemptTime: number = 0;
  private isLocked: boolean = false;
  private lockExpiryTime: number = 0;

  constructor(private config: RateLimitConfig) {}

  /**
   * Check if an action is allowed under rate limit
   * Returns whether action is allowed and remaining attempts
   */
  check(): RateLimitResult {
    const now = Date.now();

    // Check if currently locked
    if (this.isLocked && now < this.lockExpiryTime) {
      const secondsRemaining = Math.ceil((this.lockExpiryTime - now) / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        secondsUntilReset: secondsRemaining,
        message:
          this.config.customMessage ||
          `Too many attempts. Please wait ${secondsRemaining}s.`,
      };
    }

    // Reset if time window has passed
    if (now - this.firstAttemptTime > this.config.timeWindowMs) {
      this.reset();
    }

    // Check minimum delay between attempts
    if (
      this.config.minDelayBetweenAttemptsMs &&
      this.lastAttemptTime > 0 &&
      now - this.lastAttemptTime < this.config.minDelayBetweenAttemptsMs
    ) {
      const secondsRemaining = Math.ceil(
        (this.config.minDelayBetweenAttemptsMs - (now - this.lastAttemptTime)) /
          1000,
      );
      return {
        allowed: false,
        attemptsRemaining: this.config.maxAttempts - this.attempts,
        secondsUntilReset: secondsRemaining,
        message: `Please wait ${secondsRemaining}s before trying again.`,
      };
    }

    // Check if max attempts exceeded
    if (this.attempts >= this.config.maxAttempts) {
      // Lock for remaining window duration
      const lockDuration = Math.max(
        this.config.timeWindowMs - (now - this.firstAttemptTime),
        60000, // Minimum 1 minute lock
      );
      this.isLocked = true;
      this.lockExpiryTime = now + lockDuration;

      const secondsRemaining = Math.ceil(lockDuration / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        secondsUntilReset: secondsRemaining,
        message:
          this.config.customMessage ||
          `Too many attempts. Please wait ${secondsRemaining}s.`,
      };
    }

    // Attempt is allowed
    if (this.attempts === 0) {
      this.firstAttemptTime = now;
    }
    this.lastAttemptTime = now;
    this.attempts++;

    const attemptsRemaining = this.config.maxAttempts - this.attempts;
    const timeRemaining =
      this.config.timeWindowMs - (now - this.firstAttemptTime);
    const secondsUntilReset = Math.ceil(timeRemaining / 1000);

    return {
      allowed: true,
      attemptsRemaining,
      secondsUntilReset,
    };
  }

  /**
   * Resets the rate limiter state
   */
  reset(): void {
    this.attempts = 0;
    this.firstAttemptTime = 0;
    this.lastAttemptTime = 0;
    this.isLocked = false;
    this.lockExpiryTime = 0;
  }
}

/**
 * Common rate limit configurations for OTP operations
 */
export const OTP_RATE_LIMITS = {
  /**
   * OTP Send: Max 1 send per 30 seconds, 3 sends per 15 minutes
   * Prevents SMS spam to target phone number
   */
  send: new RateLimiter({
    maxAttempts: 3,
    timeWindowMs: 15 * 60 * 1000, // 15 minutes
    minDelayBetweenAttemptsMs: 30 * 1000, // 30 seconds minimum
    customMessage: "Please wait before requesting a new OTP.",
  }),

  /**
   * OTP Verify: Max 5 attempts per 5 minutes
   * Prevents brute force guessing of 6-digit codes
   */
  verify: new RateLimiter({
    maxAttempts: 5,
    timeWindowMs: 5 * 60 * 1000, // 5 minutes
    minDelayBetweenAttemptsMs: 1 * 1000, // 1 second minimum between attempts
    customMessage: "Too many failed attempts. Please request a new OTP.",
  }),

  /**
   * OTP Resend: Max 2 resends per 10 minutes
   * Prevents rapid resend abuse
   */
  resend: new RateLimiter({
    maxAttempts: 2,
    timeWindowMs: 10 * 60 * 1000, // 10 minutes
    minDelayBetweenAttemptsMs: 2 * 1000, // 2 seconds minimum
    customMessage: "Please wait before requesting another OTP.",
  }),
};
