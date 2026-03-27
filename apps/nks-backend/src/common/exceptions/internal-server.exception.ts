import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 500 Internal Server Error — unexpected server-side failure.
 *
 * Use this when a try/catch catches something truly unexpected.
 * Avoid leaking raw error messages to the client.
 */
export class InternalServerException extends AppException {
  constructor(
    input:
      | string
      | Partial<AppExceptionPayload> = 'An unexpected error occurred',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.INTERNAL_SERVER_ERROR, message: input }
        : {
            errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
            ...input,
          };

    super(payload, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
