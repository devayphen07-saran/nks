/**
 * API version constants — single source of truth for middleware and interceptor.
 *
 * To introduce a new API version:
 *   1. Increment CURRENT_API_VERSION to the new value
 *   2. Keep the old version in SUPPORTED_VERSIONS until its Sunset date passes
 *   3. Annotate old-version routes with @Deprecated({ sunset: 'YYYY-MM-DD' })
 *   4. Remove the old version from SUPPORTED_VERSIONS once sunset
 */
export const CURRENT_API_VERSION = '1';

/**
 * Versions the server currently accepts — current + any active deprecation window.
 * Used by ApiVersionMiddleware for both request validation and X-API-Version response header.
 */
export const SUPPORTED_VERSIONS = new Set<string>([CURRENT_API_VERSION]);

/**
 * Extract the API version number from a URL path that starts with `/api/v{n}`.
 *
 * Examples:
 *   /api/v1/users  → '1'
 *   /api/v2/users  → '2'   (unsupported → middleware returns 400)
 *   /health        → undefined
 */
export function extractUrlVersion(path: string): string | undefined {
  const match = /^\/api\/v(\d+)/.exec(path);
  return match ? match[1] : undefined;
}
