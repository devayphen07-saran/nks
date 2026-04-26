import { ForbiddenException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../constants/error-codes.constants';
import { SystemRoleCodes } from '../constants/system-role-codes.constant';

export class AuthorizationValidator {
  /**
   * Validate user can perform action on their own resource.
   */
  static validateOwnResource(
    resourceOwnerId: number,
    requestingUserId: number,
  ): void {
    if (resourceOwnerId !== requestingUserId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: ErrorMessages[ErrorCode.FORBIDDEN],
      });
    }
  }

  /**
   * Validate user has specific role.
   */
  static validateUserRole(
    userRole: string | string[],
    requiredRole: string | string[],
  ): void {
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (!userRoles.some((r) => required.includes(r))) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: ErrorMessages[ErrorCode.FORBIDDEN],
      });
    }
  }


  /**
   * Validate user has a role in the target store.
   */
  static validateStoreAccess(
    userStores: number[],
    targetStoreId: number,
  ): void {
    if (!userStores.includes(targetStoreId)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: ErrorMessages[ErrorCode.FORBIDDEN],
      });
    }
  }

  /**
   * Validate email verification status if required.
   */
  static validateEmailVerified(
    isEmailVerified: boolean,
    isRequired: boolean = false,
  ): void {
    if (isRequired && !isEmailVerified) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'Email verification required',
      });
    }
  }

  /**
   * Validate account status is active.
   */
  static validateAccountStatus(
    status: string,
    allowedStatuses: string[] = ['ACTIVE'],
  ): void {
    if (!allowedStatuses.includes(status)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: `Account status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }
  }

  /**
   * Validate user is not deleted/deactivated.
   */
  static validateUserActive(deletedAt: Date | null): void {
    if (deletedAt) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'User account is deactivated',
      });
    }
  }

  /**
   * Validate non-SUPER_ADMIN users cannot modify SUPER_ADMIN users.
   */
  static validateCannotModifySuperAdmin(
    targetUserRole: string | string[],
  ): void {
    const roles = Array.isArray(targetUserRole) ? targetUserRole : [targetUserRole];
    if (roles.includes(SystemRoleCodes.SUPER_ADMIN)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'Cannot modify SUPER_ADMIN users',
      });
    }
  }
}
