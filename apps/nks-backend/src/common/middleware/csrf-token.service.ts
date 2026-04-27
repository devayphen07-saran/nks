import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

/**
 * CSRF token semantics — generation, derivation, and constant-time validation.
 *
 * Token strategy:
 *
 *   Authenticated session (per-session secret stored in DB):
 *     csrfToken = HMAC-SHA256(session.csrfSecret, CSRF_HMAC_SECRET)
 *     - csrfSecret is a random 32-byte hex value unique to each session row.
 *     - Even if the session token leaks, an attacker cannot forge a CSRF token
 *       without also knowing csrfSecret (stored only server-side in DB).
 *     - Backward compat: sessions created before csrfSecret was added fall back
 *       to HMAC-SHA256(sessionToken, CSRF_HMAC_SECRET).
 *
 *   Unauthenticated (no session — pre-login):
 *     csrfToken = cryptographically random 32-byte hex
 *     - Standard double-submit baseline. Replaced by session-bound token on login.
 *
 * Rotation:
 *   - New csrfSecret generated on every new session (login, register, OTP verify).
 *   - Rotated on rolling session rotation (every 1 hour for cookie sessions).
 *   - Optionally rotated per-request on routes annotated @RotateCsrf().
 */
@Injectable()
export class CsrfTokenService {
  private readonly csrfSecret: string;

  constructor(private readonly appConfig: AppConfigService) {
    this.csrfSecret = this.appConfig.csrfHmacSecret;
  }

  /**
   * Compute CSRF token for an authenticated session.
   * @param secretOrToken session.csrfSecret when available, or session.token (backward compat)
   */
  computeForSession(secretOrToken: string): string {
    return crypto
      .createHmac('sha256', this.csrfSecret)
      .update(secretOrToken)
      .digest('hex');
  }

  /**
   * Generate a random CSRF token for unauthenticated (pre-login) requests.
   * Uses the double-submit pattern — stored in a non-httpOnly cookie so JS can echo it.
   */
  generatePreAuth(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Constant-time comparison — prevents timing attacks that could leak the
   * expected token one character at a time.
   */
  /**
   * Constant-time comparison — prevents timing attacks.
   *
   * Both inputs are hashed with SHA-256 before comparison so that
   * `timingSafeEqual` always receives equal-length buffers regardless of
   * input length. This eliminates the early-exit length check that would
   * otherwise be a timing oracle.
   */
  validate(provided: string, expected: string): boolean {
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
  }
}
