import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ErrorCodeType } from '../constants/error-codes.constants';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';
import { PG_UNIQUE_VIOLATION, PG_FOREIGN_KEY_VIOLATION, PG_NOT_NULL_VIOLATION } from '../constants/pg-error-codes';
import { ApiResponse } from '../utils/api-response';

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
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment: boolean;

  constructor(configService: ConfigService) {
    this.isDevelopment = configService.get<string>('NODE_ENV') === 'development';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const rawRequestId = request.headers['x-request-id'];
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

    const envelope = this.buildResponse(exception, request, requestId);

    if (envelope.statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${envelope.statusCode} | rid=${requestId ?? '-'}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${envelope.statusCode} | ${envelope.message} | rid=${requestId ?? '-'}`,
      );
    }

    // Add Retry-After header for rate limiting (429 responses).
    // Read retryAfter from the original exception — not from the envelope —
    // because the envelope no longer carries a generic meta blob.
    if (envelope.statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfter = this.extractRetryAfter(exception);
      response.setHeader('Retry-After', String(retryAfter));
    }

    response.status(envelope.statusCode).json(envelope);
  }

  // ─────────────────────────────────────────────────────────────────────────
  private buildResponse(
    exception: unknown,
    request: Request,
    requestId: string | undefined,
  ): ApiResponse<null> {
    // originalUrl preserves the full path when mounted behind a sub-router or proxy
    const path = request.originalUrl ?? request.url;

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
        path,
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
        path,
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
        path,
        requestId,
      });
    }

    // 4. PostgreSQL / Drizzle DB errors
    if (this.isDbError(exception)) {
      return this.handleDbError(
        exception as { code: string; detail?: string; table?: string },
        path,
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
      path,
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
    path: string,
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
      message = 'Referenced record does not exist';
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
    } else if (exception.code === PG_NOT_NULL_VIOLATION) {
      // NOT NULL violation is always a service-layer bug (a required field was not set),
      // never a user error. Log at error level to surface it immediately.
      this.logger.error(
        'NOT NULL constraint violation — likely a service bug, not a user error',
        JSON.stringify({ code: exception.code, detail: exception.detail, table: exception.table }),
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
      path,
      requestId,
    });
  }
}
