import type { Request } from 'express';
import { TokenExtractorService } from './token-extractor.service';
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

describe('TokenExtractorService', () => {
  let service: TokenExtractorService;

  beforeEach(() => {
    service = new TokenExtractorService();
  });

  describe('Bearer extraction', () => {
    it('extracts Bearer token', () => {
      const req = buildReq({ authorization: 'Bearer my-token-123' });
      expect(service.extract(req)).toEqual({ token: 'my-token-123', authType: 'bearer' });
    });

    it('rejects Bearer token longer than 512 chars', () => {
      const req = buildReq({ authorization: 'Bearer ' + 'a'.repeat(513) });
      const err = catchError<UnauthorizedException>(() => service.extract(req));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('accepts Bearer token of exactly 512 chars', () => {
      const token = 'a'.repeat(512);
      const req = buildReq({ authorization: 'Bearer ' + token });
      expect(service.extract(req)).toEqual({ token, authType: 'bearer' });
    });
  });

  describe('Cookie extraction', () => {
    it('extracts session cookie', () => {
      const req = buildReq({ cookie: 'cookie-token' });
      expect(service.extract(req)).toEqual({ token: 'cookie-token', authType: 'cookie' });
    });

    it('rejects cookie longer than 512 chars', () => {
      const req = buildReq({ cookie: 'a'.repeat(513) });
      expect(() => service.extract(req)).toThrow(UnauthorizedException);
    });
  });

  describe('Mixed Bearer + cookie', () => {
    it('rejects mixed usage from web client', () => {
      const req = buildReq({ authorization: 'Bearer b', cookie: 'c' });
      expect(() => service.extract(req)).toThrow(BadRequestException);
    });

    it('accepts mixed usage from mobile client (X-Device-Type: IOS)', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'IOS',
      });
      expect(service.extract(req).authType).toBe('bearer');
    });

    it('accepts mixed usage when device-type lowercase android', () => {
      const req = buildReq({
        authorization: 'Bearer b-token',
        cookie: 'c-token',
        deviceType: 'android',
      });
      expect(service.extract(req).authType).toBe('bearer');
    });

    it('rejects mixed usage when X-Device-Type is WEB', () => {
      const req = buildReq({
        authorization: 'Bearer b',
        cookie: 'c',
        deviceType: 'WEB',
      });
      expect(() => service.extract(req)).toThrow(BadRequestException);
    });
  });

  describe('Missing token', () => {
    it('throws UnauthorizedException when no auth provided', () => {
      const req = buildReq({});
      const err = catchError<UnauthorizedException>(() => service.extract(req));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });
  });
});