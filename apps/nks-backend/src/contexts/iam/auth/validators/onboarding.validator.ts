import { UnauthorizedException, BadRequestException, ConflictException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class OnboardingValidator {
  static assertUserFound<T>(user: T | null | undefined): asserts user is T {
    if (!user) throw new UnauthorizedException(errPayload(ErrorCode.USER_NOT_FOUND));
  }

  static assertPasswordRequired(email: string | null | undefined, password: string | null | undefined): void {
    if (email && !password) throw new BadRequestException(errPayload(ErrorCode.AUTH_PASSWORD_REQUIRED));
  }

  static assertEmailNotTaken(emailTaken: boolean): void {
    if (emailTaken) throw new ConflictException(errPayload(ErrorCode.USER_EMAIL_ALREADY_EXISTS));
  }
}
