import { SetMetadata } from '@nestjs/common';

export interface DeprecationMeta {
  /**
   * ISO-8601 date string — when the endpoint will be removed.
   * Emitted as the RFC 8594 `Sunset` header.
   * @example '2026-12-31'
   */
  sunset: string;
  /**
   * Absolute URL of the replacement endpoint.
   * Emitted as `Link: <url>; rel="successor-version"` when provided.
   */
  successor?: string;
}

export const DEPRECATED_KEY = 'deprecated';

/**
 * Mark a route as deprecated. TransformInterceptor reads this metadata and sets
 * RFC 8594 response headers on every matching request:
 *
 *   Deprecation: true
 *   Sunset: Tue, 31 Dec 2026 00:00:00 GMT
 *   Link: /api/v2/users; rel="successor-version"   (when successor is set)
 *
 * @example
 *   @Deprecated({ sunset: '2026-12-31', successor: '/api/v2/users' })
 *   @Get('users')
 *   listUsersV1() { ... }
 */
export const Deprecated = (meta: DeprecationMeta) => SetMetadata(DEPRECATED_KEY, meta);
