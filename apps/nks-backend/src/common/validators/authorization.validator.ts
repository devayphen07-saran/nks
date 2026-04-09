import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';

/**
 * Authorization Validator
 * Validates authorization and permission checks for business logic
 */
export class AuthorizationValidator {
  /**
   * Validate user can perform action on their own resource
   * Allows SUPER_ADMIN to bypass check
   */
  static validateOwnResource(
    resourceOwnerId: number,
    requestingUserId: number,
    isSuperAdmin: boolean = false,
  ): void {
    if (isSuperAdmin) return; // SUPER_ADMIN can do anything

    if (resourceOwnerId !== requestingUserId) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: ErrorMessages[ErrorCodes.GEN_FORBIDDEN],
      });
    }
  }

  /**
   * Validate user has specific role
   */
  static validateUserRole(
    userRole: string | string[],
    requiredRole: string | string[],
  ): void {
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    const required = Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];

    const hasRole = userRoles.some((r) => required.includes(r));

    if (!hasRole) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: ErrorMessages[ErrorCodes.GEN_FORBIDDEN],
      });
    }
  }

  /**
   * Validate user is not trying to escalate privileges
   */
  static validateNoPrivilegeEscalation(
    requestingUserRole: string,
    targetRole: string,
    isSuperAdmin: boolean = false,
  ): void {
    if (isSuperAdmin) return; // SUPER_ADMIN can assign any role

    const roleHierarchy = ['USER', 'STAFF', 'STORE_OWNER', 'SUPER_ADMIN'];
    const requestingLevel = roleHierarchy.indexOf(requestingUserRole);
    const targetLevel = roleHierarchy.indexOf(targetRole);

    if (targetLevel >= requestingLevel) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: 'Cannot assign role equal to or higher than your own',
      });
    }
  }

  /**
   * Validate user has access to store
   */
  static validateStoreAccess(
    userStores: number[],
    targetStoreId: number,
    isSuperAdmin: boolean = false,
  ): void {
    if (isSuperAdmin) return; // SUPER_ADMIN has access to all stores

    if (!userStores.includes(targetStoreId)) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: ErrorMessages[ErrorCodes.GEN_FORBIDDEN],
      });
    }
  }

  /**
   * Validate email verification status if required
   */
  static validateEmailVerified(
    isEmailVerified: boolean,
    isRequired: boolean = false,
  ): void {
    if (isRequired && !isEmailVerified) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: 'Email verification required',
      });
    }
  }

  /**
   * Validate account status is active
   */
  static validateAccountStatus(
    status: string,
    allowedStatuses: string[] = ['ACTIVE'],
  ): void {
    if (!allowedStatuses.includes(status)) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: `Account status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }
  }

  /**
   * Validate user is not deleted/deactivated
   */
  static validateUserActive(deletedAt: Date | null): void {
    if (deletedAt) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: 'User account is deactivated',
      });
    }
  }

  /**
   * Validate user cannot perform action on superadmin
   */
  static validateCannotModifySuperAdmin(
    targetUserRole: string | string[],
    isSuperAdmin: boolean = false,
  ): void {
    if (isSuperAdmin) return; // SUPER_ADMIN can modify other SUPER_ADMIN

    const roles = Array.isArray(targetUserRole)
      ? targetUserRole
      : [targetUserRole];
    if (roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: 'Cannot modify SUPER_ADMIN users',
      });
    }
  }
}
