import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

/**
 * CodesValidator
 *
 * Business-rule validation for code-category / code-value CRUD.
 * Extracted from CodesService so the service is pure orchestration.
 */
export class CodesValidator {
  /**
   * Ensure a code category was found; throw 404 otherwise.
   */
  static assertCategoryFound<T>(category: T | null | undefined): asserts category is T {
    if (!category) {
      throw new NotFoundException(errPayload(ErrorCode.COD_CATEGORY_NOT_FOUND));
    }
  }

  /**
   * Ensure a code value was found; throw 404 otherwise.
   */
  static assertValueFound<T>(value: T | null | undefined): asserts value is T {
    if (!value) {
      throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    }
  }

  /**
   * Ensure the value is not a system-managed value.
   */
  static assertNotSystem(isSystem: boolean): void {
    if (isSystem) {
      throw new ForbiddenException(errPayload(ErrorCode.COD_SYSTEM_IMMUTABLE));
    }
  }

  /**
   * Ensure the caller owns the store this value belongs to.
   */
  static assertStoreOwnership(isOwner: boolean): void {
    if (!isOwner) {
      throw new ForbiddenException(errPayload(ErrorCode.COD_STORE_OWNERSHIP_REQUIRED));
    }
  }

  /**
   * Ensure the update actually returned a result.
   */
  static assertUpdateSucceeded<T>(result: T | null | undefined): asserts result is T {
    if (!result) {
      throw new BadRequestException(errPayload(ErrorCode.COD_UPDATE_FAILED));
    }
  }
}
