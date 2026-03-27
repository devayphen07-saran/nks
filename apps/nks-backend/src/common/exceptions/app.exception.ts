import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from '../constants/error-codes.constants';

export interface AppExceptionPayload {
  errorCode: ErrorCodeType;
  message: string;
  errors?: Record<string, string[]> | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Base application exception.
 *
 * All custom exceptions in this project extend this class.
 * It ensures every error carries a typed `errorCode`, a human-readable
 * `message`, and optional validation `errors` / debug `meta`.
 */
export class AppException extends HttpException {
  public readonly code: ErrorCodeType;
  public readonly errors: Record<string, string[]> | null;
  public readonly meta: Record<string, unknown> | null;

  constructor(
    payload: AppExceptionPayload,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(
      {
        status: 'error',
        code: payload.errorCode,
        message: payload.message,
        errors: payload.errors ?? null,
        meta: payload.meta ?? null,
      },
      statusCode,
    );

    this.code = payload.errorCode;
    this.errors = payload.errors ?? null;
    this.meta = payload.meta ?? null;
  }
}
