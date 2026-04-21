import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

/**
 * LookupsValidator
 *
 * Business-rule validation for lookup admin CRUD.
 * Extracted from LookupsService so the service is pure orchestration.
 */
export class LookupsValidator {
  /**
   * Ensure a lookup slug is in the whitelist; throw 404 otherwise.
   */
  static assertLookupExists(handler: unknown): void {
    if (!handler) {
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_NOT_FOUND));
    }
  }

  /**
   * Ensure a lookup category was found; throw 404 otherwise.
   */
  static assertCategoryFound<T>(category: T | null | undefined): asserts category is T {
    if (!category) {
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    }
  }

  /**
   * Ensure a lookup value was found; throw 404 otherwise.
   */
  static assertValueFound<T>(value: T | null | undefined): asserts value is T {
    if (!value) {
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    }
  }

  /**
   * Ensure the update actually returned a result.
   */
  static assertUpdateSucceeded<T>(result: T | null | undefined): asserts result is T {
    if (!result) {
      throw new BadRequestException(errPayload(ErrorCode.LOOKUP_UPDATE_FAILED));
    }
  }
}
