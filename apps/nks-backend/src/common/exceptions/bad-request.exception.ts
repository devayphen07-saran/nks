import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionPayload } from './app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * 400 Bad Request — malformed input, wrong type, missing required field, etc.
 *
 * @example
 * throw new BadRequestException('Email is required');
 * throw new BadRequestException({ errorCode: ErrorCode.VALIDATION_ERROR, message: '...' });
 */
export class BadRequestException extends AppException {
  constructor(input: string | Partial<AppExceptionPayload>) {
    const payload: AppExceptionPayload =
      typeof input === 'string'
        ? { errorCode: ErrorCode.BAD_REQUEST, message: input }
        : {
            errorCode: ErrorCode.BAD_REQUEST,
            message: 'Bad request',
            ...input,
          };

    super(payload, HttpStatus.BAD_REQUEST);
  }
}
