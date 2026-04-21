import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * PermissionsPolicyMiddleware
 *
 * Sets the Permissions-Policy header to deny browser APIs not needed by a POS app.
 * Helmet does not set this header natively, so it's applied separately.
 *
 * Denies: camera, microphone, geolocation, usb, payment, fullscreen.
 */
@Injectable()
export class PermissionsPolicyMiddleware implements NestMiddleware {
  private static readonly POLICY =
    'camera=(), microphone=(), geolocation=(), usb=(), payment=(), fullscreen=()';

  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Permissions-Policy', PermissionsPolicyMiddleware.POLICY);
    next();
  }
}
