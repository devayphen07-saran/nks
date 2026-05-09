import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppConfigService } from '../../config/app-config.service';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ErrorCodeType } from '../constants/error-codes.constants';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';
import { PG_UNIQUE_VIOLATION, PG_FOREIGN_KEY_VIOLATION, PG_NOT_NULL_VIOLATION } from '../constants/pg-error-codes';
import { ApiResponse } from '../utils/api-response';
import { AuditEvents } from '../events/audit.events';

/**
 * Global exception filter — sole builder of error envelopes.
 *
 * Priority order:
 *  1. AppException           – typed domain exceptions (carries errorCode, errors, details)
 *  2. ZodValidationException – field-level validation errors → errors: Record<string, string[]>
 *  3. HttpException          – standard NestJS HTTP exceptions
 *  4. PostgreSQL / DB errors – unique constraint, FK violation
 *  5. Unknown errors         – safe 500 fallback
 *
 * All paths return ApiResponse<null> — identical wire shape to success responses.
 */
/** Cap stack-trace bytes written to the structured logger. Prevents pathological
 *  errors (deeply nested async stacks, recursive promise chains) from flooding
 *  log storage. 50 frames covers any real-world debug case. */
const MAX_STACK_BYTES = 8 * 1024;
const MAX_STACK_LINES = 50;

function truncateStack(stack: string | undefined): string | undefined {
  if (!stack) return stack;
  const lines = stack.split('\n');
  let truncated = lines.length > MAX_STACK_LINES
    ? lines.slice(0, MAX_STACK_LINES).join('\n') + `\n  … truncated ${lines.length - MAX_STACK_LINES} more frame(s)`
    : stack;
  if (truncated.length > MAX_STACK_BYTES) {
    truncated = truncated.slice(0, MAX_STACK_BYTES) + ' … (truncated by byte cap)';
  }
  return truncated;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment: boolean;

  constructor(
    appConfig: AppConfigService,
    private readonly events: EventEmitter2,
  ) {
    this.isDevelopment = appConfig.isDevelopment;
  }

  /**
   * Best-effort audit of every 403 outcome (post-authentication permission denial).
   * 401 events are skipped — most are anonymous probes that would flood the audit log;
   * authentication failures inside business logic should be audited at the source.
   * Never throws.
   */
  private auditAccessDenied(request: Request, statusCode: number, errorCode: string): void {
    try {
      const userId =
        (request as Request & { user?: { userId?: number } }).user?.userId ?? 0;
      const ip =
        (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        request.socket.remoteAddress ??
        undefined;
      this.events.emit(AuditEvents.LOG, {
        action: 'PERMISSION_REVOKED',
        userId,
        description: `Access denied: ${request.method} ${request.url} (${errorCode})`,
        metadata: {
          method: request.method,
          path: request.url,
          statusCode,
          errorCode,
          userAgent: request.headers['user-agent'],
        },
        ipAddress: ip,
        userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
        severity: 'warning',
        resourceType: 'http_request',
        resourceId: request.url,
      });
    } catch {
      // Never let audit emission break error handling.
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const rawRequestId = request.headers['x-request-id'];
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

    const envelope = this.buildResponse(exception, requestId);

    // Structured log fields: aggregators (Datadog, ELK) can filter by any of
    // these without regex-parsing the message string.
    // 3-arg form: logger.error(fields, msg, context) — nestjs-pino merges
    // `fields` into the JSON object and uses `msg` as the message string.
    if (envelope.statusCode >= 500) {
      this.logger.error(
        {
          method: request.method,
          url: request.url,
          statusCode: envelope.statusCode,
          requestId,
          errorCode: envelope.errorCode,
          err: exception instanceof Error
            ? { message: exception.message, stack: truncateStack(exception.stack), name: exception.name }
            : String(exception),
        },
        'Unhandled exception',
        GlobalExceptionFilter.name,
      );
    } else {
      this.logger.warn(
        {
          method: request.method,
          url: request.url,
          statusCode: envelope.statusCode,
          requestId,
          errorCode: envelope.errorCode,
        },
        envelope.message,
        GlobalExceptionFilter.name,
      );
    }

    // Add Retry-After header for rate limiting (429 responses).
    // Read retryAfter from the original exception — not from the envelope —
    // because the envelope no longer carries a generic meta blob.
    if (envelope.statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfter = this.extractRetryAfter(exception);
      response.setHeader('Retry-After', String(retryAfter));
    }

    // Audit every authorization denial so compliance has a paper trail of
    // denied attempts (not just the generic 403 returned to the client).
    if (envelope.statusCode === HttpStatus.FORBIDDEN) {
      this.auditAccessDenied(request, envelope.statusCode, envelope.errorCode ?? 'UNKNOWN');
    }

    response.status(envelope.statusCode).json(envelope);
  }

  // ─────────────────────────────────────────────────────────────────────────
  private buildResponse(
    exception: unknown,
    requestId: string | undefined,
  ): ApiResponse<null> {
    // 1. Our custom AppException (carries errorCode, errors, details)
    if (exception instanceof AppException) {
      const res = exception.getResponse() as Record<string, unknown>;
      const rawCode = res['errorCode'] ?? res['code'];
      const errorCode =
        typeof rawCode === 'string' && !/^\d+$/.test(rawCode)
          ? rawCode
          : this.inferErrorCode(exception.getStatus());
      return new ApiResponse({
        status: 'error',
        statusCode: exception.getStatus(),
        message: String(res['message'] ?? exception.message),
        errorCode,
        errors: (res['errors'] as Record<string, string[]> | null) ?? null,
        details: (res['details'] as string[] | null) ?? null,
        requestId,
      });
    }

    // 2. Zod validation errors from nestjs-zod
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      const errors: Record<string, string[]> = {};
      for (const issue of zodError.issues) {
        const field = issue.path.join('.') || '_root';
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      return new ApiResponse({
        status: 'error',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errorCode: ErrorCode.VALIDATION_ERROR,
        errors,
        requestId,
      });
    }

    // 3. NestJS built-in HttpException
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      const responseData =
        typeof res === 'object' && res !== null
          ? (res as Record<string, unknown>)
          : { message: String(res) };

      const message = Array.isArray(responseData['message'])
        ? (responseData['message'] as string[]).join('; ')
        : String(responseData['message'] ?? exception.message);

      const rawCode = responseData['errorCode'] ?? responseData['code'];
      const errorCode =
        typeof rawCode === 'string' && !/^\d+$/.test(rawCode)
          ? rawCode
          : this.inferErrorCode(statusCode);

      return new ApiResponse({
        status: 'error',
        statusCode,
        message,
        errorCode,
        errors: (responseData['errors'] as Record<string, string[]> | null) ?? null,
        details: (responseData['details'] as string[] | null) ?? null,
        requestId,
      });
    }

    // 4. PostgreSQL / Drizzle DB errors
    // Drizzle wraps PG errors: top-level is a DrizzleError, original PG error is in .cause
    const dbErr = this.isDbError(exception)
      ? exception
      : this.isDbError((exception as Record<string, unknown>)?.['cause'])
        ? (exception as Record<string, unknown>)['cause']
        : null;
    if (dbErr) {
      return this.handleDbError(
        dbErr as { code: string; detail?: string; table?: string },
        requestId,
      );
    }

    // 5. Fallback — unknown / unexpected error
    const message = this.isDevelopment
      ? String((exception as Record<string, unknown>)?.['message'] ?? 'An unexpected error occurred')
      : 'An unexpected error occurred';

    return new ApiResponse({
      status: 'error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  private extractRetryAfter(exception: unknown): number {
    if (exception instanceof AppException) {
      const res = exception.getResponse() as Record<string, unknown>;
      const meta = res['meta'] as Record<string, unknown> | undefined;
      if (typeof meta?.['retryAfter'] === 'number') return meta['retryAfter'] as number;
    }
    if (exception instanceof HttpException) {
      const res = exception.getResponse() as Record<string, unknown>;
      if (typeof res['retryAfter'] === 'number') return res['retryAfter'] as number;
    }
    return 60;
  }

  // ─────────────────────────────────────────────────────────────────────────
  private inferErrorCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 422:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case 429:
        return ErrorCode.TOO_MANY_REQUESTS;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  private isDbError(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) return false;
    const err = exception as Record<string, unknown>;
    // SQLSTATE codes are exactly 5 alphanumeric characters (PostgreSQL spec).
    // Also require routine or schema — fields pg always populates but generic
    // libraries with coincidental 5-char codes typically do not.
    return (
      typeof err['code'] === 'string' &&
      /^[0-9A-Z]{5}$/.test(err['code'] as string) &&
      typeof err['severity'] === 'string' &&
      (typeof err['routine'] === 'string' || typeof err['schema'] === 'string')
    );
  }

  private handleDbError(
    exception: { code: string; detail?: string; table?: string },
    requestId: string | undefined,
  ): ApiResponse<null> {
    let errorCode: ErrorCodeType = ErrorCode.DB_QUERY_FAILED;
    let message = 'A database error occurred';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception.code === PG_UNIQUE_VIOLATION) {
      errorCode = ErrorCode.DB_UNIQUE_CONSTRAINT_VIOLATION;
      message = 'A record with this value already exists';
      statusCode = HttpStatus.CONFLICT;
    } else if (exception.code === PG_FOREIGN_KEY_VIOLATION) {
      errorCode = ErrorCode.DB_FOREIGN_KEY_VIOLATION;
      // PostgreSQL detail for delete-restriction: "Key (id)=(X) is still referenced from table Y"
      // PostgreSQL detail for insert/update FK miss: "Key (field)=(X) is not present in table Y"
      const isDeleteRestriction = exception.detail?.includes('still referenced from table');
      if (isDeleteRestriction) {
        message = 'Cannot delete: this record is referenced by other data';
        statusCode = HttpStatus.CONFLICT;
      } else {
        message = 'Referenced record does not exist';
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      }
    } else if (exception.code === PG_NOT_NULL_VIOLATION) {
      // NOT NULL violation is always a service-layer bug (a required field was not set),
      // never a user error. Log at error level to surface it immediately.
      this.logger.error(
        { dbCode: exception.code, detail: exception.detail, table: exception.table },
        'NOT NULL constraint violation — likely a service bug, not a user error',
        GlobalExceptionFilter.name,
      );
      // statusCode stays INTERNAL_SERVER_ERROR (500), message stays generic
    }

    return new ApiResponse({
      status: 'error',
      statusCode,
      message,
      errorCode,
      details: this.isDevelopment
        ? [
            `dbCode: ${exception.code}`,
            exception.detail ?? '',
            exception.table ? `table: ${exception.table}` : '',
          ].filter(Boolean)
        : null,
      requestId,
    });
  }
}
