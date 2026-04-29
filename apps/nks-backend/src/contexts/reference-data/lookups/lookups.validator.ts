import {
  NotFoundException,
  ForbiddenException,
} from '../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';

interface LookupTypeRef {
  id: number;
  code: string;
  hasTable: boolean;
}

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
}