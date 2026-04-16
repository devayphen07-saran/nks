/**
 * Rate Limiter Utility
 *
 * Prevents brute force and abuse attacks on OTP operations.
 * State is persisted to AsyncStorage so that rate limits survive app restarts
 * — a user cannot bypass a lockout by force-closing and reopening the app.
 *
 * Server-side rate limiting (OtpRateLimitService) is the authoritative gate;
 * this is a complementary client-side defence that avoids unnecessary requests.
 *
 * Design:
 *   check()          — pure read, no side-effects
 *   recordAttempt()  — increments counter + persists
 *   reset()          — clears counters + persists
 *   clear()          — async, removes storage key entirely (call on logout)
 *   initialize()     — async, loads persisted state (call once at startup)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of attempts allowed within the time window */
  maxAttempts: number;
  /** Time window in milliseconds */
  timeWindowMs: number;
  /** Minimum delay between consecutive attempts in milliseconds */
  minDelayBetweenAttemptsMs?: number;
  /** Custom user-facing message when rate limited */
  customMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  secondsUntilReset: number;
  message?: string;
}

interface PersistedState {
  a: number;  // attempts
  f: number;  // firstAttemptTime
  l: number;  // lastAttemptTime
  k: boolean; // isLocked
  e: number;  // lockExpiryTime
}

// ─── Class ───────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "ratelimit:";

export class RateLimiter {
  private attempts = 0;
  private firstAttemptTime = 0;
  private lastAttemptTime = 0;
  private isLocked = false;
  private lockExpiryTime = 0;
  private readonly storageKey: string;
  private initialized = false;

  constructor(
    private readonly config: RateLimitConfig,
    identifier: string,
  ) {
    this.storageKey = `${STORAGE_PREFIX}${identifier}`;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Load persisted state from AsyncStorage.
   * Must be called once before the first `check()`. Idempotent.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (raw) {
        const s: PersistedState = JSON.parse(raw);
        if (typeof s.a === "number" && s.a >= 0) {
          this.attempts = s.a;
          this.firstAttemptTime = s.f;
          this.lastAttemptTime = s.l;
          this.isLocked = s.k;
          this.lockExpiryTime = s.e;
        }
      }
    } catch {
      // Corrupted or missing — start fresh (in-memory defaults are all 0/false)
    }

    this.initialized = true;
  }

  // ── Core API ─────────────────────────────────────────────────────────────

  /**
   * Pure read — returns whether the next attempt is allowed.
   * Does NOT record the attempt. Call `recordAttempt()` separately
   * after the action is actually dispatched.
   */
  check(): RateLimitResult {
    const now = Date.now();

    // Unlock if lock has expired
    if (this.isLocked && now >= this.lockExpiryTime) {
      this.clearInternal();
      this.persist();
    }

    // Still locked
    if (this.isLocked) {
      const secondsRemaining = Math.ceil((this.lockExpiryTime - now) / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        secondsUntilReset: secondsRemaining,
        message:
          this.config.customMessage ??
          `Too many attempts. Please wait ${secondsRemaining}s.`,
      };
    }

    // Time window elapsed — counters are stale
    if (this.attempts > 0 && now - this.firstAttemptTime > this.config.timeWindowMs) {
      this.clearInternal();
      this.persist();
    }

    // Minimum delay between attempts
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

    // Max attempts reached — engage lock
    if (this.attempts >= this.config.maxAttempts) {
      const lockDuration = Math.max(
        this.config.timeWindowMs - (now - this.firstAttemptTime),
        60_000, // minimum 1 minute
      );
      this.isLocked = true;
      this.lockExpiryTime = now + lockDuration;
      this.persist();

      const secondsRemaining = Math.ceil(lockDuration / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        secondsUntilReset: secondsRemaining,
        message:
          this.config.customMessage ??
          `Too many attempts. Please wait ${secondsRemaining}s.`,
      };
    }

    // Allowed
    const attemptsRemaining = this.config.maxAttempts - this.attempts;
    return { allowed: true, attemptsRemaining, secondsUntilReset: 0 };
  }

  /**
   * Record a consumed attempt. Call after `check().allowed === true`
   * and the action has been dispatched.
   */
  recordAttempt(): void {
    const now = Date.now();
    if (this.attempts === 0) {
      this.firstAttemptTime = now;
    }
    this.lastAttemptTime = now;
    this.attempts++;
    this.persist();
  }

  /**
   * Synchronous reset — clears in-memory counters and persists.
   */
  reset(): void {
    this.clearInternal();
    this.persist();
  }

  /**
   * Async clear — removes the storage key entirely.
   * Call on logout so stale counters don't leak across user sessions.
   */
  async clear(): Promise<void> {
    this.clearInternal();
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch {
      // Non-critical
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private clearInternal(): void {
    this.attempts = 0;
    this.firstAttemptTime = 0;
    this.lastAttemptTime = 0;
    this.isLocked = false;
    this.lockExpiryTime = 0;
  }

  /** Fire-and-forget write to AsyncStorage. */
  private persist(): void {
    const state: PersistedState = {
      a: this.attempts,
      f: this.firstAttemptTime,
      l: this.lastAttemptTime,
      k: this.isLocked,
      e: this.lockExpiryTime,
    };
    AsyncStorage.setItem(this.storageKey, JSON.stringify(state)).catch(() => {});
  }
}

// ─── Singleton instances ─────────────────────────────────────────────────────

/**
 * Pre-configured OTP rate limiters.
 *
 * Call `initializeRateLimiters()` once during app startup before the first
 * `check()` call so that persisted state is loaded from AsyncStorage.
 */
export const OTP_RATE_LIMITS = {
  /** Max 3 sends per 15 min, 30 s minimum gap. Prevents SMS spam. */
  send: new RateLimiter(
    {
      maxAttempts: 3,
      timeWindowMs: 15 * 60 * 1000,
      minDelayBetweenAttemptsMs: 30 * 1000,
      customMessage: "Please wait before requesting a new OTP.",
    },
    "otp_send",
  ),

  /** Max 5 verifications per 5 min, 1 s gap. Prevents brute-force. */
  verify: new RateLimiter(
    {
      maxAttempts: 5,
      timeWindowMs: 5 * 60 * 1000,
      minDelayBetweenAttemptsMs: 1 * 1000,
      customMessage: "Too many failed attempts. Please request a new OTP.",
    },
    "otp_verify",
  ),

  /** Max 2 resends per 10 min, 2 s gap. Prevents rapid resend abuse. */
  resend: new RateLimiter(
    {
      maxAttempts: 2,
      timeWindowMs: 10 * 60 * 1000,
      minDelayBetweenAttemptsMs: 2 * 1000,
      customMessage: "Please wait before requesting another OTP.",
    },
    "otp_resend",
  ),
};

// ─── Lifecycle helpers ───────────────────────────────────────────────────────

/**
 * Hydrate all OTP rate limiters from AsyncStorage.
 * Call once during app startup (e.g. inside the initializeAuth thunk).
 */
export async function initializeRateLimiters(): Promise<void> {
  await Promise.all([
    OTP_RATE_LIMITS.send.initialize(),
    OTP_RATE_LIMITS.verify.initialize(),
    OTP_RATE_LIMITS.resend.initialize(),
  ]);
}

/**
 * Synchronously resets all OTP rate limiter counters.
 * Persists the cleared state to AsyncStorage.
 */
export function resetRateLimiters(): void {
  OTP_RATE_LIMITS.send.reset();
  OTP_RATE_LIMITS.verify.reset();
  OTP_RATE_LIMITS.resend.reset();
}

/**
 * Async clear — removes all rate limiter storage keys.
 * Call on logout to prevent stale counters leaking across user sessions.
 */
export async function clearRateLimiters(): Promise<void> {
  await Promise.all([
    OTP_RATE_LIMITS.send.clear(),
    OTP_RATE_LIMITS.verify.clear(),
    OTP_RATE_LIMITS.resend.clear(),
  ]);
}
