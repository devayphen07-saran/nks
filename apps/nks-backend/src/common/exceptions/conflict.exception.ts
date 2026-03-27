import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 409 Conflict — the resource already exists or a unique constraint was violated.
 */
export class ConflictException extends AppException {
  constructor(
    input: string | Partial<AppExceptionPayload> = 'Resource already exists',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.CONFLICT, message: input }
        : {
            errorCode: ErrorCode.CONFLICT,
            message: 'Resource already exists',
            ...input,
          };

    super(payload, HttpStatus.CONFLICT);
  }
}
