import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

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
  // Methods that require CSRF validation
  private readonly UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

  // Endpoints that bypass CSRF check (login, register)
  private readonly CSRF_EXEMPT_ROUTES = [
    '/api/v1/auth/',
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

        if (!providedToken || providedToken !== csrfToken) {
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
        httpOnly: false, // Frontend needs to read this
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 3600 * 1000, // 1 hour
        path: '/',
      });
    }

    return token;
  }

  /**
   * Parse cookies from request header
   */
  private parseCookies(req: Request): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookieHeader = req.headers.cookie || '';

    cookieHeader.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Check if route is exempt from CSRF validation
   */
  private isExemptRoute(path: string): boolean {
    return this.CSRF_EXEMPT_ROUTES.some((exemptRoute) =>
      path.startsWith(exemptRoute),
    );
  }
}
