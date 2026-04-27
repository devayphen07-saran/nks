import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Request-scoped correlation ID for distributed tracing.
 * Preserves an X-Request-ID sent by the client; generates a UUID v4 otherwise.
 * Echoes the chosen ID on the response as X-Request-ID and writes it into
 * req.headers so guards, interceptors, and filters all read the same value.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
