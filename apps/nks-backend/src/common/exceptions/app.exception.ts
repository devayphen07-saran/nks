import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType, ErrorCode } from '../constants/error-codes.constants';

export interface AppExceptionPayload {
  errorCode: ErrorCodeType;
  message: string;
  errors?: Record<string, string[]> | null;
  meta?: Record<string, unknown> | null;
}

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

export class BadRequestException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Bad request') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.BAD_REQUEST, message: input }
        : { errorCode: ErrorCode.BAD_REQUEST, message: 'Bad request', ...input };
    super(payload, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Unauthorized') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.UNAUTHORIZED, message: input }
        : { errorCode: ErrorCode.UNAUTHORIZED, message: 'Unauthorized', ...input };
    super(payload, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Access forbidden') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.FORBIDDEN, message: input }
        : { errorCode: ErrorCode.FORBIDDEN, message: 'Access forbidden', ...input };
    super(payload, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Resource not found') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.NOT_FOUND, message: input }
        : { errorCode: ErrorCode.NOT_FOUND, message: 'Resource not found', ...input };
    super(payload, HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Resource already exists') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.CONFLICT, message: input }
        : { errorCode: ErrorCode.CONFLICT, message: 'Resource already exists', ...input };
    super(payload, HttpStatus.CONFLICT);
  }
}

export class UnprocessableException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Unprocessable request') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.UNPROCESSABLE_ENTITY, message: input }
        : { errorCode: ErrorCode.UNPROCESSABLE_ENTITY, message: 'Unprocessable request', ...input };
    super(payload, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TooManyRequestsException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Too many requests, please slow down') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.TOO_MANY_REQUESTS, message: input }
        : { errorCode: ErrorCode.TOO_MANY_REQUESTS, message: 'Too many requests, please slow down', ...input };
    super(payload, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class InternalServerException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'An unexpected error occurred') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.INTERNAL_SERVER_ERROR, message: input }
        : { errorCode: ErrorCode.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred', ...input };
    super(payload, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
