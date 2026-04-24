import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
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
      finalize(() => {
        const ms = Date.now() - start;
        // req.route?.path is the route template (e.g. /users/:id/sessions) rather than
        // the actual URL with param values. This keeps log lines groupable in Datadog/ELK
        // — without it, every UUID in a path generates a unique log entry.
        const routePath = (req as Request & { route?: { path?: string } }).route?.path ?? url;
        this.logger.log(
          `${method} ${routePath} → ${res.statusCode} (${ms}ms)${requestId ? ` [${requestId}]` : ''}`,
        );
      }),
    );
  }

}
