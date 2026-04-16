import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit_max';

/**
 * Override the default rate limit (100 req / 15 min) for a specific endpoint.
 *
 * @param max Maximum requests allowed per IP within the 15-minute window.
 *
 * @example
 * @RateLimit(10)   // login — 10 attempts per 15 min per IP
 * @RateLimit(30)   // refresh — 30 refreshes per 15 min per IP
 */
export const RateLimit = (max: number) => SetMetadata(RATE_LIMIT_KEY, max);
