import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 404 Not Found — the requested resource does not exist.
 */
export class NotFoundException extends AppException {
  constructor(
    input: string | Partial<AppExceptionPayload> = 'Resource not found',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.NOT_FOUND, message: input }
        : {
            errorCode: ErrorCode.NOT_FOUND,
            message: 'Resource not found',
            ...input,
          };

    super(payload, HttpStatus.NOT_FOUND);
  }
}
