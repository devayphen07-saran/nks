import {
  NotFoundException,
  ForbiddenException,
} from '../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import type { LookupTypeRef } from './repositories/lookups.repository';

type LookupValueRef = { isSystem: boolean };

/**
 * LookupsValidator — validation logic for lookup operations.
 *
 * Ensures lookups are valid and modifiable (not system-managed types).
 */
export class LookupsValidator {
  /**
   * Assert that a lookup type exists and is editable (not system-managed).
   * System-managed types (hasTable=true) are read-only and cannot be modified.
   */
  static assertLookupTypeValid(
    type: LookupTypeRef | null,
  ): asserts type is LookupTypeRef {
    if (!type)
      throw new NotFoundException(
        errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND),
      );
    if (type.hasTable)
      throw new ForbiddenException(
        errPayload(ErrorCode.LOOKUP_SYSTEM_TYPE_READONLY),
      );
  }

  /** Assert that an individual lookup value is not system-seeded and can be mutated. */
  static assertLookupValueEditable(value: LookupValueRef): void {
    if (value.isSystem)
      throw new ForbiddenException(
        errPayload(ErrorCode.LOOKUP_SYSTEM_VALUE_READONLY),
      );
  }
}