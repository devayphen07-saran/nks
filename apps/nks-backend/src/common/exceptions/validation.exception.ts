import { BadRequestException } from '@nestjs/common';

/**
 * ValidationException
 * Custom exception for validation errors with error codes
 * Extends BadRequestException to provide structured error responses
 */
export class ValidationException extends BadRequestException {
  constructor(
    public readonly errorCode: string,
    message?: string,
  ) {
    super(message || `Validation failed: ${errorCode}`);
    this.name = 'ValidationException';
  }

  getErrorCode(): string {
    return this.errorCode;
  }
}
