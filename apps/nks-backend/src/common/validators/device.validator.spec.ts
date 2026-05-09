import { Logger } from '@nestjs/common';
import { DeviceValidator } from './device.validator';

describe('DeviceValidator', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('validateAndNormalize — auto-detection (no header)', () => {
    it('detects IOS from iPhone User-Agent', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('IOS');
    });

    it('detects IOS from iPad User-Agent', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('IOS');
    });

    it('detects ANDROID from Android User-Agent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7)';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('ANDROID');
    });

    it('detects WEB from Windows User-Agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('WEB');
    });

    it('detects WEB from macOS User-Agent', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('WEB');
    });

    it('detects WEB from Linux User-Agent', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0';
      expect(DeviceValidator.validateAndNormalize(undefined, ua)).toBe('WEB');
    });

    it('returns null for an unrecognized User-Agent', () => {
      expect(DeviceValidator.validateAndNormalize(undefined, 'curl/7.68.0')).toBeNull();
    });

    it('returns null when User-Agent is undefined', () => {
      expect(DeviceValidator.validateAndNormalize(undefined, undefined)).toBeNull();
    });
  });

  describe('validateAndNormalize — explicit header', () => {
    it('returns header value when it matches User-Agent', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(DeviceValidator.validateAndNormalize('IOS', ua)).toBe('IOS');
    });

    it('uppercases lowercase header value', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(DeviceValidator.validateAndNormalize('ios', ua)).toBe('IOS');
    });

    it('trusts User-Agent over header on mismatch', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(DeviceValidator.validateAndNormalize('WEB', ua)).toBe('IOS');
    });

    it('falls back to UA detection when header is invalid', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13)';
      expect(DeviceValidator.validateAndNormalize('INVALID_TYPE', ua)).toBe('ANDROID');
    });

    it('returns null when header is invalid and UA is undetectable', () => {
      expect(DeviceValidator.validateAndNormalize('INVALID', 'curl/7.68.0')).toBeNull();
    });

    it('accepts header when UA is undetectable', () => {
      expect(DeviceValidator.validateAndNormalize('IOS', 'curl/7.68.0')).toBe('IOS');
    });

    it('accepts WEB header when UA is undetectable', () => {
      expect(DeviceValidator.validateAndNormalize('WEB', undefined)).toBe('WEB');
    });
  });

  describe('logDeviceInfo', () => {
    it('does not throw with all parameters defined', () => {
      expect(() =>
        DeviceValidator.logDeviceInfo('IOS', 'Mozilla/5.0 (iPhone)', 'IOS'),
      ).not.toThrow();
    });

    it('does not throw with all parameters undefined/null', () => {
      expect(() => DeviceValidator.logDeviceInfo(undefined, undefined, null)).not.toThrow();
    });
  });
});