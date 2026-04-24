import { NotFoundException, ConflictException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class EntityStatusValidator {
  static assertStatusFound<T>(row: T | null | undefined): asserts row is T {
    if (!row) throw new NotFoundException(errPayload(ErrorCode.ENT_STATUS_NOT_FOUND));
  }

  static assertNotAlreadyAssigned(existing: { isActive: boolean } | null | undefined): void {
    if (existing?.isActive) throw new ConflictException(errPayload(ErrorCode.ENT_STATUS_ALREADY_ASSIGNED));
  }

  static assertAssignmentExists<T>(mapping: T | null | undefined): asserts mapping is T {
    if (!mapping) throw new NotFoundException(errPayload(ErrorCode.ENT_STATUS_NOT_ASSIGNED));
  }
}
