import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 429 Too Many Requests — rate limit exceeded (OTP floods, login attempts, etc.).
 */
export class TooManyRequestsException extends AppException {
  constructor(
    input:
      | string
      | Partial<AppExceptionPayload> = 'Too many requests, please slow down',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.TOO_MANY_REQUESTS, message: input }
        : {
            errorCode: ErrorCode.TOO_MANY_REQUESTS,
            message: 'Too many requests, please slow down',
            ...input,
          };

    super(payload, HttpStatus.TOO_MANY_REQUESTS);
  }
}
