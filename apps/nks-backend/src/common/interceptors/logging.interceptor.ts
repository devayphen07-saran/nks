import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { DEPRECATED_KEY, type DeprecationMeta } from '../decorators/deprecated.decorator';

/**
 * LoggingInterceptor — structured request/response logging and HTTP meta-headers.
 *
 * Responsibilities:
 *   1. Measure end-to-end handler duration and emit a structured log line.
 *   2. Inject RFC-compliant Deprecation / Sunset / Link headers for routes
 *      annotated with @Deprecated(). Runs before the handler so that headers
 *      are set before any streaming response begins.
 *
 * Intentionally decoupled from ResponseInterceptor so each concern can be
 * toggled, tested, or replaced independently.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    this.applyDeprecationHeaders(context, res);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          });
        },
        error: (err: unknown) => {
          this.logger.warn({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      }),
    );
  }

  private applyDeprecationHeaders(context: ExecutionContext, res: Response): void {
    const deprecation = this.reflector.getAllAndOverride<DeprecationMeta | undefined>(
      DEPRECATED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!deprecation) return;

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(deprecation.sunset).toUTCString());
    if (deprecation.successor) {
      res.setHeader('Link', `<${deprecation.successor}>; rel="successor-version"`);
    }
  }
}
