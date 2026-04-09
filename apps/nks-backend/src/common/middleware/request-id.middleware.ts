import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique `X-Request-ID` header to every incoming request/response.
 *
 * Uses the client-provided value if present, otherwise generates a UUID v4.
 * This ID propagates through logs and error responses for full traceability.
 *
 * Register in AppModule:
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(RequestIdMiddleware).forRoutes('*');
 *   }
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
