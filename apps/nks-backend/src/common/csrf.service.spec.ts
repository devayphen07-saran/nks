import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { CsrfService } from './csrf.service';
import { AppConfigService } from '../config/app-config.service';
import { ForbiddenException } from './exceptions';
import { ErrorCode } from './constants/error-codes.constants';

const buildReq = (overrides: {
  method?: string;
  csrfHeader?: string;
  cookies?: Record<string, string>;
} = {}): Request =>
  ({
    method: overrides.method ?? 'GET',
    headers: overrides.csrfHeader ? { 'x-csrf-token': overrides.csrfHeader } : {},
    cookies: overrides.cookies ?? {},
  }) as unknown as Request;

const catchError = <T>(fn: () => void): T | undefined => {
  try { fn(); } catch (e) { return e as T; }
  return undefined;
};

describe('CsrfService (session-bound double-submit)', () => {
  let service: CsrfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrfService,
        { provide: AppConfigService, useValue: { isProduction: false, csrfSameSite: 'strict' } },
      ],
    }).compile();

    service = module.get<CsrfService>(CsrfService);
  });

  describe('generate', () => {
    it('returns a 64-char hex string', () => {
      expect(service.generate()).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns a unique value on each call', () => {
      expect(service.generate()).not.toBe(service.generate());
    });
  });

  describe('validateRequest', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      it(`is a no-op for ${method}`, () => {
        expect(() => service.validateRequest(buildReq({ method }), 'session-secret')).not.toThrow();
      });
    }

    it('passes when X-CSRF-Token header equals the session secret', () => {
      const req = buildReq({ method: 'POST', csrfHeader: 'session-secret' });
      expect(() => service.validateRequest(req, 'session-secret')).not.toThrow();
    });

    it('passes for PUT, DELETE, PATCH when header matches secret', () => {
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const req = buildReq({ method, csrfHeader: 's' });
        expect(() => service.validateRequest(req, 's')).not.toThrow();
      }
    });

    it('throws ForbiddenException when header is missing on POST', () => {
      const req = buildReq({ method: 'POST' });
      const err = catchError<ForbiddenException>(() => service.validateRequest(req, 's'));
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err?.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('throws ForbiddenException when header value differs from secret', () => {
      const req = buildReq({ method: 'POST', csrfHeader: 'attacker-tossed' });
      expect(() => service.validateRequest(req, 'real-session-secret')).toThrow(ForbiddenException);
    });

    it('rejects subdomain-tossed cookies (cookie value is not consulted)', () => {
      // Attacker controls a subdomain and sets csrf_token=attacker-value.
      // They forge X-CSRF-Token: attacker-value to match. With pure double-submit
      // the server would compare header == cookie and accept. With session-bound
      // validation the secret must match the SERVER-stored value, which the
      // attacker cannot forge.
      const req = buildReq({
        method: 'POST',
        csrfHeader: 'attacker-tossed',
        cookies: { csrf_token: 'attacker-tossed' },
      });
      expect(() => service.validateRequest(req, 'real-session-secret')).toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    let res: { cookie: jest.Mock };

    beforeEach(() => { res = { cookie: jest.fn() }; });

    it('issues csrf_token cookie with the session secret as value', () => {
      service.refresh(res as unknown as Response, 'session-secret-value');
      expect(res.cookie).toHaveBeenCalledTimes(1);
      const [name, value] = res.cookie.mock.calls[0];
      expect(name).toBe('csrf_token');
      expect(value).toBe('session-secret-value');
    });

    it('sets cookie with httpOnly: false (so JS can read it for the header)', () => {
      service.refresh(res as unknown as Response, 's');
      const opts = res.cookie.mock.calls[0][2];
      expect(opts.httpOnly).toBe(false);
    });
  });

  describe('clear', () => {
    it('calls clearCookie on csrf_token', () => {
      const res = { clearCookie: jest.fn() } as unknown as Response;
      service.clear(res);
      expect((res as unknown as { clearCookie: jest.Mock }).clearCookie)
        .toHaveBeenCalledWith('csrf_token', expect.any(Object));
    });
  });
});
