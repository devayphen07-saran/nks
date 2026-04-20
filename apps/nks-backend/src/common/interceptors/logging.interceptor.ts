import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * Logs every incoming request and its response time.
 *
 * Output format: [METHOD] /path → STATUS (Xms)
 *
 * Register globally in main.ts:
 *   app.useGlobalInterceptors(new LoggingInterceptor());
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const start = Date.now();

    const requestId = req.headers['x-request-id'] as string | undefined;

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          `${method} ${url} → ${res.statusCode} (${ms}ms)${requestId ? ` [${requestId}]` : ''}`,
        );
      }),
    );
  }
}
