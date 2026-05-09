import { BadRequestException } from '@nestjs/common';
import { SessionValidator, DeviceTypeEnum, AuthMethodEnum } from './session.validator';

describe('SessionValidator', () => {
  describe('validateDeviceType', () => {
    it('returns undefined when no input provided', () => {
      expect(SessionValidator.validateDeviceType(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(SessionValidator.validateDeviceType('')).toBeUndefined();
    });

    it('returns IOS enum for valid IOS input', () => {
      expect(SessionValidator.validateDeviceType('IOS')).toBe(DeviceTypeEnum.IOS);
    });

    it('returns ANDROID enum for valid ANDROID input', () => {
      expect(SessionValidator.validateDeviceType('ANDROID')).toBe(DeviceTypeEnum.ANDROID);
    });

    it('returns WEB enum for valid WEB input', () => {
      expect(SessionValidator.validateDeviceType('WEB')).toBe(DeviceTypeEnum.WEB);
    });

    it('throws BadRequestException for an unknown device type', () => {
      expect(() => SessionValidator.validateDeviceType('UNKNOWN')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for lowercase valid value (case-sensitive)', () => {
      expect(() => SessionValidator.validateDeviceType('ios')).toThrow(BadRequestException);
    });
  });

  describe('validateLoginMethod', () => {
    it('returns undefined when no input provided', () => {
      expect(SessionValidator.validateLoginMethod(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(SessionValidator.validateLoginMethod('')).toBeUndefined();
    });

    it('returns OTP enum for valid OTP input', () => {
      expect(SessionValidator.validateLoginMethod('OTP')).toBe(AuthMethodEnum.OTP);
    });

    it('returns PASSWORD enum for valid PASSWORD input', () => {
      expect(SessionValidator.validateLoginMethod('PASSWORD')).toBe(AuthMethodEnum.PASSWORD);
    });

    it('returns GOOGLE enum for valid GOOGLE input', () => {
      expect(SessionValidator.validateLoginMethod('GOOGLE')).toBe(AuthMethodEnum.GOOGLE);
    });

    it('throws BadRequestException for an unknown login method', () => {
      expect(() => SessionValidator.validateLoginMethod('SMS')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for lowercase valid value (case-sensitive)', () => {
      expect(() => SessionValidator.validateLoginMethod('password')).toThrow(BadRequestException);
    });
  });
});