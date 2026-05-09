import { ForbiddenException } from '@nestjs/common';
import { AuthorizationValidator } from './authorization.validator';

describe('AuthorizationValidator', () => {
  describe('validateOwnResource', () => {
    it('does not throw when IDs match', () => {
      expect(() => AuthorizationValidator.validateOwnResource(1, 1)).not.toThrow();
    });

    it('throws ForbiddenException when IDs differ', () => {
      expect(() => AuthorizationValidator.validateOwnResource(1, 2)).toThrow(ForbiddenException);
    });
  });

  describe('validateUserRole', () => {
    it('does not throw when single role matches required single role', () => {
      expect(() => AuthorizationValidator.validateUserRole('ADMIN', 'ADMIN')).not.toThrow();
    });

    it('does not throw when user role array contains required role', () => {
      expect(() => AuthorizationValidator.validateUserRole(['ADMIN', 'USER'], 'ADMIN')).not.toThrow();
    });

    it('does not throw when user role matches one of required roles array', () => {
      expect(() => AuthorizationValidator.validateUserRole('ADMIN', ['ADMIN', 'SUPER_ADMIN'])).not.toThrow();
    });

    it('does not throw when both are arrays with at least one match', () => {
      expect(() => AuthorizationValidator.validateUserRole(['USER', 'ADMIN'], ['ADMIN', 'MANAGER'])).not.toThrow();
    });

    it('throws ForbiddenException when no matching role', () => {
      expect(() => AuthorizationValidator.validateUserRole('USER', 'ADMIN')).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when no match in either array', () => {
      expect(() => AuthorizationValidator.validateUserRole(['USER'], ['ADMIN', 'MANAGER'])).toThrow(ForbiddenException);
    });
  });

  describe('validateStoreAccess', () => {
    it('does not throw when target store is in user stores', () => {
      expect(() => AuthorizationValidator.validateStoreAccess([1, 2, 3], 2)).not.toThrow();
    });

    it('throws ForbiddenException when target store is not in user stores', () => {
      expect(() => AuthorizationValidator.validateStoreAccess([1, 2], 5)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for empty user stores array', () => {
      expect(() => AuthorizationValidator.validateStoreAccess([], 1)).toThrow(ForbiddenException);
    });
  });

  describe('validateEmailVerified', () => {
    it('does not throw when email is verified', () => {
      expect(() => AuthorizationValidator.validateEmailVerified(true)).not.toThrow();
    });

    it('does not throw when not required and email is not verified', () => {
      expect(() => AuthorizationValidator.validateEmailVerified(false, false)).not.toThrow();
    });

    it('does not throw when isRequired defaults to false', () => {
      expect(() => AuthorizationValidator.validateEmailVerified(false)).not.toThrow();
    });

    it('throws ForbiddenException when required and not verified', () => {
      expect(() => AuthorizationValidator.validateEmailVerified(false, true)).toThrow(ForbiddenException);
    });
  });

  describe('validateAccountStatus', () => {
    it('does not throw for ACTIVE status with default allowed list', () => {
      expect(() => AuthorizationValidator.validateAccountStatus('ACTIVE')).not.toThrow();
    });

    it('does not throw when status is in custom allowed list', () => {
      expect(() => AuthorizationValidator.validateAccountStatus('PENDING', ['PENDING', 'ACTIVE'])).not.toThrow();
    });

    it('throws ForbiddenException for SUSPENDED status against default allowed list', () => {
      expect(() => AuthorizationValidator.validateAccountStatus('SUSPENDED')).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when status not in custom list', () => {
      expect(() => AuthorizationValidator.validateAccountStatus('ACTIVE', ['PENDING'])).toThrow(ForbiddenException);
    });
  });

  describe('validateUserActive', () => {
    it('does not throw when deletedAt is null', () => {
      expect(() => AuthorizationValidator.validateUserActive(null)).not.toThrow();
    });

    it('throws ForbiddenException when deletedAt is set', () => {
      expect(() => AuthorizationValidator.validateUserActive(new Date())).toThrow(ForbiddenException);
    });
  });

  describe('validateCannotModifySuperAdmin', () => {
    it('does not throw for non-super-admin role string', () => {
      expect(() => AuthorizationValidator.validateCannotModifySuperAdmin('ADMIN')).not.toThrow();
    });

    it('does not throw for non-super-admin role array', () => {
      expect(() => AuthorizationValidator.validateCannotModifySuperAdmin(['ADMIN', 'MANAGER'])).not.toThrow();
    });

    it('throws ForbiddenException when role string is SUPER_ADMIN', () => {
      expect(() => AuthorizationValidator.validateCannotModifySuperAdmin('SUPER_ADMIN')).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role array contains SUPER_ADMIN', () => {
      expect(() => AuthorizationValidator.validateCannotModifySuperAdmin(['ADMIN', 'SUPER_ADMIN'])).toThrow(ForbiddenException);
    });
  });
});
