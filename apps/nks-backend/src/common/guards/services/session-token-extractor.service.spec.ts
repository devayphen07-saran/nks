import type { Request } from 'express';
import { SessionTokenExtractorService } from './session-token-extractor.service';
import { BadRequestException, UnauthorizedException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';
import { AuthControllerHelpers } from '../../utils/auth-helpers';

const COOKIE_NAME = AuthControllerHelpers.SESSION_COOKIE_NAME;

const buildReq = (overrides: {
  authorization?: string;
  cookie?: string;
  deviceType?: string;
} = {}): Request => {
  const headers: Record<string, string> = {};
  if (overrides.authorization) headers['authorization'] = overrides.authorization;
  if (overrides.deviceType) headers['x-device-type'] = overrides.deviceType;
  return {
    headers,
    cookies: overrides.cookie ? { [COOKIE_NAME]: overrides.cookie } : {},
  } as unknown as Request;
};

const catchError = <T>(fn: () => void): T | undefined => {
  try { fn(); } catch (e) { return e as T; }
  return undefined;
};

describe('SessionTokenExtractorService', () => {
  let service: SessionTokenExtractorService;

  beforeEach(() => {
    service = new SessionTokenExtractorService();
  });

  describe('Bearer token extraction', () => {
    it('extracts token from Bearer authorization header', () => {
      const req = buildReq({ authorization: 'Bearer my-token-123' });
      expect(service.extract(req)).toEqual({ token: 'my-token-123', authType: 'bearer' });
    });

    it('trims whitespace from Bearer token', () => {
      const req = buildReq({ authorization: 'Bearer   my-token-123  ' });
      expect(service.extract(req)).toEqual({ token: 'my-token-123', authType: 'bearer' });
    });
  });

  describe('Cookie token extraction', () => {
    it('extracts token from session cookie', () => {
      const req = buildReq({ cookie: 'cookie-token-456' });
      expect(service.extract(req)).toEqual({ token: 'cookie-token-456', authType: 'cookie' });
    });
  });

  describe('Mixed Bearer + cookie', () => {
    it('rejects mixed usage from a non-mobile client (CSRF risk)', () => {
      const req = buildReq({ authorization: 'Bearer b-token', cookie: 'c-token' });
      const err = catchError<BadRequestException>(() => service.extract(req));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.BAD_REQUEST);
    });

    it('accepts mixed usage when X-Device-Type is IOS (uppercase)', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'IOS',
      });
      expect(service.extract(req)).toEqual({ token: 'b-token', authType: 'bearer' });
    });

    it('accepts mixed usage when X-Device-Type is ANDROID (uppercase)', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'ANDROID',
      });
      expect(service.extract(req).authType).toBe('bearer');
    });

    it('accepts mixed usage when X-Device-Type is lowercase ios', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'ios',
      });
      expect(service.extract(req).authType).toBe('bearer');
    });

    it('accepts mixed usage when X-Device-Type is lowercase android', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'android',
      });
      expect(service.extract(req).authType).toBe('bearer');
    });

    it('rejects mixed usage when X-Device-Type is WEB', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'WEB',
      });
      expect(() => service.extract(req)).toThrow(BadRequestException);
    });
  });

  describe('Missing token', () => {
    it('throws UnauthorizedException with AUTH_TOKEN_INVALID when no token present', () => {
      const req = buildReq({});
      const err = catchError<UnauthorizedException>(() => service.extract(req));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('throws when authorization header is non-Bearer (e.g., Basic)', () => {
      const req = buildReq({ authorization: 'Basic dXNlcjpwYXNz' });
      expect(() => service.extract(req)).toThrow(UnauthorizedException);
    });
  });
});