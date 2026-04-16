import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { parseCookieHeader } from '../utils/cookie.utils';

/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery by:
 * 1. Generating CSRF tokens and storing in httpOnly cookies
 * 2. Validating CSRF tokens from request headers/body on unsafe methods (POST, PUT, DELETE, PATCH)
 * 3. Requiring Same-Site cookie policy
 *
 * Safe methods (GET, HEAD, OPTIONS) bypass CSRF check.
 * The frontend automatically includes CSRF token via X-CSRF-Token header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  // Methods that require CSRF validation
  private readonly UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

  // Unauthenticated endpoints that bypass CSRF check.
  // These are public routes that neither read cookies for auth nor change
  // server-side state on behalf of a logged-in user — the classic CSRF threat.
  //
  // Authenticated cookie-using routes (token/verify, session DELETE) are
  // intentionally excluded so they still require a valid CSRF token.
  private readonly CSRF_EXEMPT_ROUTES = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh-token',
    '/auth/logout',
    '/auth/sync-time',
    '/auth/session-status',
    '/auth/otp/send',
    '/auth/otp/verify',
    '/auth/otp/resend',
    '/auth/otp/email/send',
    '/auth/otp/email/verify',
    '/auth/.well-known/jwks.json',
    '/auth/mobile-jwks',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Bearer token requests (mobile/API clients) are immune to CSRF by design —
    // CSRF is a cookie-based attack. Skip validation for these clients entirely.
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    // Generate or get existing CSRF token
    const csrfToken = this.getOrCreateCsrfToken(req, res);

    // Store token in response headers for frontend to read
    res.setHeader('X-CSRF-Token', csrfToken);

    // Validate CSRF token for unsafe methods
    if (this.UNSAFE_METHODS.includes(req.method)) {
      // Check if route is exempt from CSRF check
      if (!this.isExemptRoute(req.path)) {
        const providedToken =
          req.headers['x-csrf-token'] ||
          req.body?.csrfToken ||
          req.query.csrfToken;

        const tokenMatch =
          typeof providedToken === 'string' &&
          providedToken.length === csrfToken.length &&
          crypto.timingSafeEqual(
            Buffer.from(providedToken),
            Buffer.from(csrfToken),
          );
        if (!tokenMatch) {
          return res.status(403).json({
            success: false,
            message: 'CSRF token missing or invalid',
          });
        }
      }
    }

    next();
  }

  /**
   * Get existing CSRF token from cookie or create new one
   */
  private getOrCreateCsrfToken(req: Request, res: Response): string {
    const cookies = this.parseCookies(req);
    let token = cookies['csrf_token'];

    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf_token', token, {
        httpOnly: true, // JS cannot read — token delivered via X-CSRF-Token response header
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: 3600 * 1000, // 1 hour
        path: '/',
      });
    }

    return token;
  }

  private parseCookies(req: Request): Record<string, string> {
    return parseCookieHeader(req.headers.cookie ?? '');
  }

  /**
   * Check if route is exempt from CSRF validation.
   * Uses exact match against the explicit allowlist — no prefix matching.
   */
  private isExemptRoute(path: string): boolean {
    return this.CSRF_EXEMPT_ROUTES.includes(path);
  }
}
