import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request-scoped correlation ID for distributed tracing.
 *
 * ── Propagation contract ──────────────────────────────────────────────────
 *
 *  Ingress:
 *    - If the client sent `X-Request-ID`, that value is preserved and reused.
 *      (Allows upstream gateways / load balancers / clients to generate the
 *      ID and have it thread through the entire call tree.)
 *    - Otherwise a UUID v4 is generated here.
 *
 *  In-process:
 *    - The chosen ID is written back onto `req.headers['x-request-id']` so
 *      any code reading it downstream (guards, interceptors, filters,
 *      services) sees the same value regardless of whether the client
 *      supplied it.
 *    - `TransformInterceptor` and `GlobalExceptionFilter` both pull the ID
 *      from `req.headers['x-request-id']` and stamp it onto the response
 *      envelope as `requestId`.
 *    - Logs in the exception filter include it as `rid=<uuid>` for quick
 *      correlation with the client-facing response.
 *
 *  Egress:
 *    - `X-Request-ID` is set on the response headers so the client can read
 *      the ID from headers (in addition to the body's `requestId` field)
 *      without parsing the JSON — useful when streaming or on non-JSON
 *      responses.
 *
 *  Outbound calls:
 *    - Any service making outbound HTTP calls should forward
 *      `X-Request-ID` from the current request so downstream services
 *      stitch into the same trace. (Enforce via a shared http-client
 *      wrapper if adding external calls.)
 *
 * Registered in AppModule:
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
