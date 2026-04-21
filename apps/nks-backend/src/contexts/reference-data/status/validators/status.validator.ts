import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

/**
 * StatusValidator
 *
 * Business-rule validation for status CRUD.
 * Extracted from StatusService so the service is pure orchestration.
 */
export class StatusValidator {
  /**
   * Ensure a status was found; throw 404 otherwise.
   */
  static assertFound<T>(status: T | null | undefined): asserts status is T {
    if (!status) {
      throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    }
  }

  /**
   * Ensure a status code does not already exist.
   */
  static assertCodeUnique(existing: unknown): void {
    if (existing) {
      throw new ConflictException(errPayload(ErrorCode.STA_CODE_ALREADY_EXISTS));
    }
  }

  /**
   * Ensure the status is not a system-managed status.
   */
  static assertNotSystem(isSystem: boolean): void {
    if (isSystem) {
      throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));
    }
  }
}
