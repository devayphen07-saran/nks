import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 422 Unprocessable Entity — input is technically valid but violates a business rule.
 *
 * @example
 * throw new UnprocessableException({
 *   errorCode: ErrorCode.USER_CANNOT_DELETE_SELF,
 *   message: 'You cannot delete your own account',
 * });
 */
export class UnprocessableException extends AppException {
  constructor(
    input: string | Partial<AppExceptionPayload> = 'Unprocessable request',
  ) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.UNPROCESSABLE_ENTITY, message: input }
        : {
            errorCode: ErrorCode.UNPROCESSABLE_ENTITY,
            message: 'Unprocessable request',
            ...input,
          };

    super(payload, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
