import { BadRequestException } from '@nestjs/common';
import { PasswordValidator } from './password.validator';

const VALID = 'StrongPass1!';

describe('PasswordValidator', () => {
  describe('validateStrength', () => {
    it('does not throw for a valid password', () => {
      expect(() => PasswordValidator.validateStrength(VALID)).not.toThrow();
    });

    it('throws for empty string', () => {
      expect(() => PasswordValidator.validateStrength('')).toThrow(BadRequestException);
    });

    it('throws for password shorter than 12 chars', () => {
      expect(() => PasswordValidator.validateStrength('Short1!')).toThrow(BadRequestException);
    });

    it('throws when no uppercase letter', () => {
      expect(() => PasswordValidator.validateStrength('nouppercase1!')).toThrow(BadRequestException);
    });

    it('throws when no lowercase letter', () => {
      expect(() => PasswordValidator.validateStrength('NOLOWERCASE1!')).toThrow(BadRequestException);
    });

    it('throws when no digit', () => {
      expect(() => PasswordValidator.validateStrength('NoDigitHere!!')).toThrow(BadRequestException);
    });

    it('throws when no special character', () => {
      expect(() => PasswordValidator.validateStrength('NoSpecial1234')).toThrow(BadRequestException);
    });

    it('throws for password of exactly 11 chars with all requirements except length', () => {
      expect(() => PasswordValidator.validateStrength('ValidPass1!')).toThrow(BadRequestException);
    });

    it('does not throw for password of exactly 12 chars', () => {
      expect(() => PasswordValidator.validateStrength('ValidPass12!')).not.toThrow();
    });
  });

  describe('isStrong', () => {
    it('returns true for a valid password', () => {
      expect(PasswordValidator.isStrong(VALID)).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(PasswordValidator.isStrong('')).toBe(false);
    });

    it('returns false for password too short', () => {
      expect(PasswordValidator.isStrong('Short1!')).toBe(false);
    });

    it('returns false when missing uppercase', () => {
      expect(PasswordValidator.isStrong('nouppercase1!')).toBe(false);
    });

    it('returns false when missing lowercase', () => {
      expect(PasswordValidator.isStrong('NOLOWERCASE1!')).toBe(false);
    });

    it('returns false when missing digit', () => {
      expect(PasswordValidator.isStrong('NoDigitHere!!')).toBe(false);
    });

    it('returns false when missing special character', () => {
      expect(PasswordValidator.isStrong('NoSpecial1234')).toBe(false);
    });

    it('returns true for password with exactly 12 chars and all requirements', () => {
      expect(PasswordValidator.isStrong('ValidPass12!')).toBe(true);
    });
  });
});
