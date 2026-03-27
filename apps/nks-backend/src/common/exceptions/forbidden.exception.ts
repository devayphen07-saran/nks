import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 403 Forbidden — authenticated but not authorized to perform the action.
 */
export class ForbiddenException extends AppException {
  constructor(
    input: string | Partial<AppExceptionPayload> = 'Access forbidden',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.FORBIDDEN, message: input }
        : {
            errorCode: ErrorCode.FORBIDDEN,
            message: 'Access forbidden',
            ...input,
          };

    super(payload, HttpStatus.FORBIDDEN);
  }
}
