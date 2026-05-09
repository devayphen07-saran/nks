import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerException } from '../../../../../common/exceptions';
import {
  ErrorCode,
  ErrorMessages,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const FETCH_TIMEOUT_MS = 1500;
const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Checks candidate passwords against HaveIBeenPwned's k-anonymity API.
 *
 * Privacy: only the first 5 chars of the SHA-1 hash leave the server. The full
 * hash is reconstructed locally from the response — HIBP never sees the
 * password or its full hash.
 *
 * Fail-open on network errors: registration must not be blocked by an external
 * outage. This is a defence-in-depth control on top of complexity validation,
 * not a critical-path dependency.
 *
 * Disable in dev/CI by setting `HIBP_BREACH_CHECK_ENABLED=false`.
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
   * Throw `AUTH_PASSWORD_BREACHED` if the password is known to be in a public
   * breach corpus. No-op when disabled or when HIBP is unreachable.
   */
  async assertNotBreached(password: string): Promise<void> {
    if (!this.enabled) return;
    const breached = await this.isBreached(password).catch((err) => {
      // Fail-open: HIBP outage must not block registration.
      this.logger.warn(
        `HIBP breach check failed (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    });
    if (breached) {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_PASSWORD_BREACHED,
        message: ErrorMessages[ErrorCode.AUTH_PASSWORD_BREACHED],
      });
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
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
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
