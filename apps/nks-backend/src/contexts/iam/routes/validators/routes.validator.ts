import { ForbiddenException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class RoutesValidator {
  static assertStoreAccess(roleIds: number[]): void {
    if (roleIds.length === 0) throw new ForbiddenException(errPayload(ErrorCode.ROUTE_STORE_ACCESS_DENIED));
  }
}
