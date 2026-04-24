import { NotFoundException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class AuditValidator {
  static assertFound<T>(row: T | null | undefined): asserts row is T {
    if (!row) throw new NotFoundException(errPayload(ErrorCode.AUDIT_LOG_NOT_FOUND));
  }
}
