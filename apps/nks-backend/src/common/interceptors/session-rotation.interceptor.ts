import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, from, switchMap, map } from 'rxjs';
import type { SessionUpdateContext } from '../guards/session-context';
import { SessionRotationService } from './session-rotation.service';

/** @deprecated Import SessionUpdateContext from guards/session-context instead. */
export type PendingSessionUpdates = SessionUpdateContext;

/**
 * SessionRotationInterceptor — thin orchestrator for post-handler session updates.
 *
 * AuthGuard stamps `req.sessionContext` after successful validation.
 * This interceptor reads that signal AFTER the handler returns and delegates
 * all DB and cookie side effects to SessionRotationService.
 *
 * Checks:
 *   - Non-HTTP contexts are passed through unchanged.
 *   - No `req.sessionContext` (Bearer / public routes): no-op.
 *   - `res.headersSent` (streaming endpoint): skip with warning to avoid
 *     writing a new session token to DB without delivering it to the client.
 */
@Injectable()
export class SessionRotationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SessionRotationInterceptor.name);

  constructor(private readonly rotation: SessionRotationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      switchMap((data) =>
        from(this.applySessionUpdates(context)).pipe(map(() => data)),
      ),
    );
  }

  private async applySessionUpdates(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const ctx = req.sessionContext;
    if (!ctx) return;

    const res = context.switchToHttp().getResponse<Response>();

    // Skip rotation on error responses — a failed handler (validation error,
    // permission denied, 5xx) should not consume a rotation slot or write cookies.
    if (res.statusCode >= 400) return;

    if (res.headersSent) {
      this.logger.warn(
        `Session update skipped for "${req.method} ${req.path}" — headers already sent. ` +
        'Avoid streaming responses on cookie-authenticated routes that require rotation.',
      );
      return;
    }

    await this.rotation.applyUpdates(req, res, ctx);
  }
}
