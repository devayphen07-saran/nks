import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '../../../../../common/exceptions';
import {
  ErrorCode,
  ErrorMessages,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const FETCH_TIMEOUT_MS = 1500;
const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type BreachCheckResult = 'BREACHED' | 'NOT_BREACHED' | 'UNAVAILABLE';

/**
 * Checks candidate passwords against HaveIBeenPwned's k-anonymity API.
 *
 * Privacy: only the first 5 chars of the SHA-1 hash leave the server. The full
 * hash is reconstructed locally from the response — HIBP never sees the
 * password or its full hash.
 *
 * Fail-CLOSED on network errors during password set/change: a silent fail-open
 * lets a known-breached password slip through if HIBP is unreachable, defeating
 * the control. Callers receive 503 AUTH_PASSWORD_BREACH_CHECK_UNAVAILABLE and
 * can retry. Upstream failures are logged at error level and emit a structured
 * `password_breach_check_unavailable` log event for metric scraping.
 *
 * Disable in dev/CI by setting `HIBP_BREACH_CHECK_ENABLED=false` (returns
 * NOT_BREACHED without contacting HIBP).
 */
@Injectable()
export class PasswordBreachCheckService {
  private readonly logger = new Logger(PasswordBreachCheckService.name);
  private readonly enabled: boolean;
  // FIFO cache: prefix → result. Capped to avoid unbounded growth.
  private readonly cache = new Map<string, { breached: boolean; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('HIBP_BREACH_CHECK_ENABLED', 'true') !== 'false';
  }

  /**
   * Throw `AUTH_PASSWORD_BREACHED` (400) if known-breached.
   * Throw `AUTH_PASSWORD_BREACH_CHECK_UNAVAILABLE` (503) if HIBP is unreachable.
   * Resolve cleanly when not breached or when the check is disabled.
   */
  async assertNotBreached(password: string): Promise<void> {
    const result = await this.checkBreach(password);

    if (result === 'BREACHED') {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_PASSWORD_BREACHED,
        message: ErrorMessages[ErrorCode.AUTH_PASSWORD_BREACHED],
      });
    }

    if (result === 'UNAVAILABLE') {
      throw new ServiceUnavailableException(
        errPayload(ErrorCode.AUTH_PASSWORD_BREACH_CHECK_UNAVAILABLE),
      );
    }
  }

  /**
   * Three-state breach check. Use `assertNotBreached()` for the common
   * throw-on-breach-or-unavailable path. Direct callers handle the tri-state
   * themselves (e.g. background revalidation that should not 503 a request).
   */
  async checkBreach(password: string): Promise<BreachCheckResult> {
    if (!this.enabled) return 'NOT_BREACHED';

    try {
      const breached = await this.isBreached(password);
      return breached ? 'BREACHED' : 'NOT_BREACHED';
    } catch (err) {
      // Structured event for metric scraping. Keep `event` static so
      // dashboards can count occurrences without parsing the message.
      this.logger.error(
        {
          event: 'password_breach_check_unavailable',
          err: err instanceof Error ? err.message : String(err),
        },
        'HIBP breach check unavailable — failing closed',
      );
      return 'UNAVAILABLE';
    }
  }

  private async isBreached(password: string): Promise<boolean> {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const cacheKey = `${prefix}:${suffix}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.breached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let body: string;
    try {
      const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
        // Add-Padding asks HIBP to pad the response so traffic-analysis cannot
        // infer how many suffixes match the prefix.
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HIBP returned status ${res.status}`);
      }
      body = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const breached = body.split('\n').some((line) => line.startsWith(suffix));
    this.setCache(cacheKey, breached);
    return breached;
  }

  private setCache(key: string, breached: boolean): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { breached, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
