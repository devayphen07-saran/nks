import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ErrorCodeType } from '../constants/error-codes.constants';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * Global exception filter.
 *
 * Priority order:
 *  1. AppException   – our custom typed exceptions (passthrough as-is)
 *  2. ZodValidationException – nestjs-zod validation errors (field-level errors)
 *  3. HttpException  – standard NestJS HTTP exceptions
 *  4. Postgres / DB errors – unique constraint, FK violation, missing column
 *  5. Unknown errors – safe 500 fallback
 *
 * All responses follow the shape:
 * {
 *   status:    'error',
 *   code:      string,
 *   message:   string,
 *   errors:    Record<string, string[]> | null,   // field-level validation
 *   meta:      Record<string, unknown> | null,    // optional debug info
 *   timestamp: string,
 *   path:      string,
 * }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.buildResponse(exception, request);

    // Log server errors (5xx)
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${status} | ${String(body.message ?? 'Unknown error')}`,
      );
    }

    // Add Retry-After header for rate limiting (429 responses)
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      response.setHeader('Retry-After', '60'); // Retry after 60 seconds
    }

    response.status(status).json(body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  private buildResponse(
    exception: unknown,
    request: Request,
  ): { status: number; body: Record<string, unknown> } {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // 1. Our custom AppException (carries code, errors, meta)
    if (exception instanceof AppException) {
      const res = exception.getResponse() as Record<string, unknown>;
      return {
        status: exception.getStatus(),
        body: { ...res, timestamp, path },
      };
    }

    // 2. Zod validation errors from nestjs-zod
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      const errors: Record<string, string[]> = {};
      for (const issue of zodError.issues) {
        const field = issue.path.join('.');
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          status: 'error',
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          errors,
          meta: null,
          timestamp,
          path,
        },
      };
    }

    // 3. NestJS built-in HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      // NestJS class-validator pipe returns { message: string[] }
      const responseData = res as Record<string, unknown>;

      // Check if response contains errorCode and message from our validators
      const errorCode = responseData?.errorCode as string | undefined;
      const message = Array.isArray(responseData?.message)
        ? responseData.message.join('; ')
        : (responseData?.message ?? exception.message);

      const code = errorCode ?? this.inferErrorCode(status);

      return {
        status,
        body: {
          status: 'error',
          statusCode: status,
          code,
          errorCode: errorCode ?? null,
          message,
          errors: (res as Record<string, unknown>)?.errors ?? null,
          details: (res as Record<string, unknown>)?.details ?? null,
          meta: null,
          timestamp,
          path,
        },
      };
    }

    // 4. PostgreSQL / Drizzle DB errors
    if (this.isDbError(exception)) {
      return this.handleDbError(
        exception as { code: string; detail?: string; table?: string },
        timestamp,
        path,
      );
    }

    // 5. Fallback — unknown / unexpected error
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : (((exception as Record<string, unknown>)?.message as string) ??
          'An unexpected error occurred');

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        status: 'error',
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message,
        errors: null,
        meta: null,
        timestamp,
        path,
      },
    };
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
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as Record<string, unknown>).code === 'string' &&
      ((exception as Record<string, unknown>).code as string).startsWith('2') // PostgreSQL error codes start with '2x'
    );
  }

  private handleDbError(
    exception: { code: string; detail?: string; table?: string },
    timestamp: string,
    path: string,
  ): { status: number; body: Record<string, unknown> } {
    let code: ErrorCodeType = ErrorCode.DB_QUERY_FAILED;
    let message = 'A database error occurred';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // 23505 – unique_violation
    if (exception.code === '23505') {
      code = ErrorCode.DB_UNIQUE_CONSTRAINT_VIOLATION;
      message = 'A record with this value already exists';
      status = HttpStatus.CONFLICT;
    }
    // 23503 – foreign_key_violation
    else if (exception.code === '23503') {
      code = ErrorCode.DB_FOREIGN_KEY_VIOLATION;
      message = 'Referenced record does not exist';
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }

    return {
      status,
      body: {
        status: 'error',
        code,
        message,
        errors: null,
        meta:
          process.env.NODE_ENV !== 'production'
            ? {
                dbCode: exception.code,
                detail: exception.detail,
                table: exception.table,
              }
            : null,
        timestamp,
        path,
      },
    };
  }
}
