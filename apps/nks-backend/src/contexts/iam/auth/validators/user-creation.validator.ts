import { BadRequestException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class UserCreationValidator {
  static assertUserCreated<T>(user: T | null | undefined): asserts user is T {
    if (!user) throw new BadRequestException(errPayload(ErrorCode.USER_CREATION_FAILED));
  }

  static assertAdminExists(exists: boolean): void {
    if (!exists) throw new BadRequestException(errPayload(ErrorCode.AUTH_NO_ADMIN_EXISTS));
  }
}
