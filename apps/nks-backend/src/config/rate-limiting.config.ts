import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ThrottlerModule types — install @nestjs/throttler before enabling
// import { ThrottlerModuleOptions } from '@nestjs/throttler';
type ThrottlerModuleOptions = {
  throttlers: Array<{ ttl: number; limit: number }>;
};

/**
 * Rate Limiting Configuration
 *
 * Configures NestJS ThrottlerModule for global API rate limiting.
 * Protects against:
 * - Credential stuffing attacks (login brute-force)
 * - API abuse and scraping
 * - Resource exhaustion attacks
 * - DDoS attacks at application level
 *
 * Strategy:
 * 1. Default: 100 requests per 15 minutes globally (all endpoints)
 * 2. Auth endpoints: Stricter limits (10 req/15min for login, 5 req/hour for OTP)
 * 3. Public endpoints: Moderate limits (50 req/15min)
 * 4. Admin endpoints: Very strict (5 req/15min)
 *
 * Configuration via environment variables:
 * - THROTTLE_TTL=900 (window duration in seconds, default 15 min)
 * - THROTTLE_LIMIT=100 (requests per window, default 100)
 * - THROTTLE_ENABLED=true (set false to disable for dev)
 */
@Injectable()
export class RateLimitingConfig {
  constructor(private configService: ConfigService) {}

  /**
   * Get ThrottlerModuleOptions for global rate limiting
   *
   * Default strategy:
   * - 100 requests per 15 minutes (all endpoints)
   * - Calculated as: 100 req / 900 sec = ~6.7 req/sec avg
   * - Bursting allowed (fast requests bunched together)
   */
  getThrottlerOptions(): ThrottlerModuleOptions {
    const enabled = this.configService.get('THROTTLE_ENABLED', true);
    const ttl = this.configService.get('THROTTLE_TTL', 900); // 15 minutes in seconds
    const limit = this.configService.get('THROTTLE_LIMIT', 100); // requests per window

    if (!enabled) {
      // Disable rate limiting (development only)
      return {
        throttlers: [{ ttl: 0, limit: 0 }],
      };
    }

    return {
      /**
       * Default throttler: applies to all endpoints not decorated with @SkipThrottle
       *
       * ttl: time-to-live in seconds (window duration)
       * limit: max requests per window
       *
       * Example: ttl=900 (15 min), limit=100
       * = 100 requests allowed every 15 minutes
       */
      throttlers: [
        {
          ttl,
          limit,
        },
      ],

      /**
       * Storage: defaults to in-memory (fast, suitable for single server)
       * For distributed setups, use Redis storage:
       * import { ThrottlerStorageRedisService } from '@nestjs/throttler';
       * storage: new ThrottlerStorageRedisService(redisClient),
       */
      // storage: new ThrottlerStorageService(), // in-memory
    };
  }

  /**
   * Rate limit presets for different endpoint categories
   * Use with @Throttle(limit, ttl) decorator on specific endpoints
   */
  static readonly PRESETS = {
    /**
     * Global default (applied to all endpoints)
     * 100 req / 15 min = ~6.7 req/sec average
     */
    DEFAULT: { limit: 100, ttl: 900 },

    /**
     * Strict: Login, password reset, sensitive operations
     * 10 req / 15 min = 1 req/90 sec = attacker needs 90 sec per attempt
     */
    AUTH_STRICT: { limit: 10, ttl: 900 },

    /**
     * Moderate: Public endpoints (lookups, routes, etc.)
     * 50 req / 15 min = ~3.3 req/sec
     */
    PUBLIC: { limit: 50, ttl: 900 },

    /**
     * Very strict: Admin operations
     * 5 req / 15 min = 1 req/3min = prevents rapid admin action abuse
     */
    ADMIN: { limit: 5, ttl: 900 },

    /**
     * Lenient: High-traffic endpoints (bulk data, exports)
     * 200 req / 15 min = ~13 req/sec
     */
    LENIENT: { limit: 200, ttl: 900 },

    /**
     * OTP-specific (should be stricter than default)
     * 5 req / 1 hour = 1 req/720 sec
     * Note: OtpRateLimitService has additional exponential backoff
     */
    OTP: { limit: 5, ttl: 3600 },
  };

  /**
   * Get rate limit info for documentation
   */
  getInfo() {
    const ttl = this.configService.get('THROTTLE_TTL', 900);
    const limit = this.configService.get('THROTTLE_LIMIT', 100);
    const enabled = this.configService.get('THROTTLE_ENABLED', true);

    return {
      enabled,
      ttl: `${ttl} seconds (${Math.round(ttl / 60)} minutes)`,
      limit: `${limit} requests`,
      ratePerSecond: (limit / ttl).toFixed(2),
      message: `${limit} requests per ${Math.round(ttl / 60)} minutes`,
    };
  }
}
