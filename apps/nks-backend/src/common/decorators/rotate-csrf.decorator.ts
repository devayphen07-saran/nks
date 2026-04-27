import { SetMetadata } from '@nestjs/common';

export const ROTATE_CSRF_KEY = 'rotateCsrf';

/**
 * Rotate the per-session CSRF secret after every successful request on this route.
 *
 * Normal routes reuse the session's csrfSecret until the session rotates (every 1 hour).
 * High-security routes (change password, revoke all sessions, delete account) should
 * annotate with @RotateCsrf() so the CSRF token is single-use — the client reads
 * the updated csrf_token cookie from the response before the next mutation.
 *
 * Only applies to cookie (web) sessions. Bearer clients are unaffected.
 *
 * @example
 *   @RotateCsrf()
 *   @Post('change-password')
 *   changePassword(...) { ... }
 */
export const RotateCsrf = () => SetMetadata(ROTATE_CSRF_KEY, true);
