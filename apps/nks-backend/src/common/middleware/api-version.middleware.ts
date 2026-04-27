import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  CURRENT_API_VERSION,
  SUPPORTED_VERSIONS,
  extractUrlVersion,
} from '../constants/api-version.constants';

/**
 * Validates the API version declared by the client — via header or URL path.
 *
 * Two signals are checked independently (either can reject the request):
 *
 *   X-API-Version header:
 *     Clients that pin a version explicitly receive a 400 when the pinned
 *     version is no longer served, instead of silently getting a different
 *     version's response.
 *
 *   URL path segment (/api/v{n}/...):
 *     Clients hitting a retired URL prefix (e.g. /api/v2/users when only
 *     v1 is live) receive a clear 400 instead of a confusing 404.
 *
 * This middleware also stamps X-API-Version on every response so clients
 * always know which version they are talking to. It runs on all requests —
 * including those that end in an exception — which is why this belongs in
 * middleware rather than an interceptor (interceptors are skipped on error paths).
 *
 * SUPPORTED_VERSIONS and extractUrlVersion live in api-version.constants.ts.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-API-Version', CURRENT_API_VERSION);

    // ── Header version ──────────────────────────────────────────────────────
    const rawHeader = req.headers['x-api-version'];
    if (rawHeader) {
      const headerVersion = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
      if (!SUPPORTED_VERSIONS.has(headerVersion)) {
        this.rejectVersion(res, headerVersion);
        return;
      }
    }

    // ── URL version ─────────────────────────────────────────────────────────
    const urlVersion = extractUrlVersion(req.path);
    if (urlVersion && !SUPPORTED_VERSIONS.has(urlVersion)) {
      this.rejectVersion(res, urlVersion);
      return;
    }

    next();
  }

  private rejectVersion(res: Response, version: string): void {
    res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: `API version '${version}' is not supported. Supported versions: ${[...SUPPORTED_VERSIONS].join(', ')}.`,
      errorCode: 'API_VERSION_UNSUPPORTED',
      data: null,
    });
  }
}
