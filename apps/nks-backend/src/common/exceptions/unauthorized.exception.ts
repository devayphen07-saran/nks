import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 401 Unauthorized — missing / invalid / expired authentication token.
 */
export class UnauthorizedException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload> = 'Unauthorized') {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.UNAUTHORIZED, message: input }
        : {
            errorCode: ErrorCode.UNAUTHORIZED,
            message: 'Unauthorized',
            ...input,
          };

    super(payload, HttpStatus.UNAUTHORIZED);
  }
}
