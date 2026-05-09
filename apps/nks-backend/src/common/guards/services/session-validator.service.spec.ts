import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SessionValidatorService } from './session-validator.service';
import { AuthContextService } from '../../../contexts/iam/auth/services/session/auth-context.service';
import { CsrfService } from '../../csrf.service';
import { UnauthorizedException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';

const buildReq = (overrides: { method?: string; deviceId?: string } = {}): Request => ({
  method: overrides.method ?? 'GET',
  headers: overrides.deviceId ? { 'x-device-id': overrides.deviceId } : {},
} as unknown as Request);

const catchError = <T>(fn: () => Promise<unknown>): Promise<T | undefined> =>
  fn().then(() => undefined).catch((e) => e as T);

const baseContext = {
  session: {
    id: 1,
    expiresAt: new Date(Date.now() + 60_000),
    csrfSecret: 'secret-abc',
    deviceId: null as string | null,
  },
  user: { id: 42 },
  roles: [{ roleCode: 'ADMIN' }],
};

describe('SessionValidatorService', () => {
  let service: SessionValidatorService;
  let authContext: { findSessionAuthContext: jest.Mock };
  let csrf: { validateRequest: jest.Mock };

  beforeEach(async () => {
    authContext = { findSessionAuthContext: jest.fn() };
    csrf = { validateRequest: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionValidatorService,
        { provide: AuthContextService, useValue: authContext },
        { provide: CsrfService, useValue: csrf },
      ],
    }).compile();

    service = module.get<SessionValidatorService>(SessionValidatorService);
  });

  describe('happy path', () => {
    it('returns session, user, and roles for a valid session', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({ ...baseContext });
      const result = await service.validate('token', buildReq(), 'bearer');
      expect(result.session).toBe(baseContext.session);
      expect(result.user).toBe(baseContext.user);
      expect(result.roles).toBe(baseContext.roles);
    });
  });

  describe('rejection paths', () => {
    it('throws AUTH_TOKEN_INVALID when session is null', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: null,
      });
      const err = await catchError<UnauthorizedException>(() => service.validate('t', buildReq(), 'bearer'));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('throws AUTH_SESSION_EXPIRED when session is expired', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: { ...baseContext.session, expiresAt: new Date(Date.now() - 60_000) },
      });
      const err = await catchError<UnauthorizedException>(() => service.validate('t', buildReq(), 'bearer'));
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_EXPIRED);
    });

    it('throws when user is null', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        user: null,
      });
      await expect(service.validate('t', buildReq(), 'bearer')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('CSRF enforcement', () => {
    it('calls CsrfService.validateRequest for cookie auth type', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({ ...baseContext });
      const req = buildReq({ method: 'POST' });
      await service.validate('t', req, 'cookie');
      expect(csrf.validateRequest).toHaveBeenCalledWith(req, 'secret-abc');
    });

    it('does not call CSRF validation for bearer auth type', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({ ...baseContext });
      await service.validate('t', buildReq({ method: 'POST' }), 'bearer');
      expect(csrf.validateRequest).not.toHaveBeenCalled();
    });
  });

  describe('device binding (bearer)', () => {
    it('passes when session has no deviceId', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: { ...baseContext.session, deviceId: null },
      });
      const req = buildReq({ deviceId: 'any-device' });
      await expect(service.validate('t', req, 'bearer')).resolves.toBeDefined();
    });

    it('passes when device IDs match', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: { ...baseContext.session, deviceId: 'device-1' },
      });
      const req = buildReq({ deviceId: 'device-1' });
      await expect(service.validate('t', req, 'bearer')).resolves.toBeDefined();
    });

    it('throws when device IDs mismatch', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: { ...baseContext.session, deviceId: 'device-1' },
      });
      const req = buildReq({ deviceId: 'device-2' });
      const err = await catchError<UnauthorizedException>(() => service.validate('t', req, 'bearer'));
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_EXPIRED);
    });

    it('throws when session has deviceId but request omits x-device-id', async () => {
      authContext.findSessionAuthContext.mockResolvedValue({
        ...baseContext,
        session: { ...baseContext.session, deviceId: 'device-1' },
      });
      const err = await catchError<UnauthorizedException>(() => service.validate('t', buildReq(), 'bearer'));
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_EXPIRED);
    });
  });
});