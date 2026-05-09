import { Test, TestingModule } from '@nestjs/testing';
import { SessionBootstrapService } from './session-bootstrap.service';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { InternalServerException } from '../../../../../common/exceptions';

describe('SessionBootstrapService', () => {
  let service: SessionBootstrapService;
  let sessionTokenRepo: { updateByToken: jest.Mock };
  let usersRepo: { findEmailAndGuuid: jest.Mock };
  let permissions: { getUserPermissions: jest.Mock };
  let authUtils: { getBetterAuthContext: jest.Mock };

  const baSession = { token: 'sess-token', expiresAt: new Date(Date.now() + 3_600_000) };

  beforeEach(async () => {
    sessionTokenRepo = { updateByToken: jest.fn() };
    usersRepo = { findEmailAndGuuid: jest.fn() };
    permissions = { getUserPermissions: jest.fn() };
    authUtils = {
      getBetterAuthContext: jest.fn().mockResolvedValue({
        internalAdapter: { createSession: jest.fn().mockResolvedValue(baSession) },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionBootstrapService,
        { provide: SessionTokenRepository, useValue: sessionTokenRepo },
        { provide: AuthUsersRepository, useValue: usersRepo },
        { provide: PermissionsService, useValue: permissions },
        { provide: AuthUtilsService, useValue: authUtils },
      ],
    }).compile();

    service = module.get<SessionBootstrapService>(SessionBootstrapService);
  });

  const stubHappyPath = (overrides: Partial<{ defaultStoreFk: number | null; roles: any[] }> = {}) => {
    permissions.getUserPermissions.mockResolvedValue({ roles: overrides.roles ?? [] });
    usersRepo.findEmailAndGuuid.mockResolvedValue({
      guuid: 'user-guuid',
      email: 'a@b.com',
      defaultStoreFk: overrides.defaultStoreFk ?? null,
    });
    sessionTokenRepo.updateByToken.mockResolvedValue({ guuid: 'session-guuid' });
  };

  describe('happy path', () => {
    beforeEach(() => stubHappyPath());

    it('returns enriched session shape', async () => {
      const result = await service.createForUser(42, undefined);
      expect(result.token).toBe('sess-token');
      expect(result.sessionGuuid).toBe('session-guuid');
      expect(result.userEmail).toBe('a@b.com');
      expect(typeof result.jti).toBe('string');
      expect(result.jti.length).toBeGreaterThan(0);
      expect(result.csrfSecret).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces a unique jti and csrfSecret per call', async () => {
      const a = await service.createForUser(42, undefined);
      const b = await service.createForUser(42, undefined);
      expect(a.jti).not.toBe(b.jti);
      expect(a.csrfSecret).not.toBe(b.csrfSecret);
    });
  });

  describe('device info handling', () => {
    beforeEach(() => stubHappyPath());

    it('persists device fields when deviceInfo is provided', async () => {
      await service.createForUser(42, {
        deviceId: 'd-1',
        deviceName: 'iPhone',
        deviceType: 'IOS',
        appVersion: '1.0.0',
        ipAddress: '1.2.3.4',
        userAgent: 'ua',
      });
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.deviceId).toBe('d-1');
      expect(update.deviceType).toBe('IOS');
      expect(update.userAgent).toBe('ua');
    });

    it('falls back to null deviceType for unknown values', async () => {
      await service.createForUser(42, { deviceType: 'BLACKBERRY' } as any);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.deviceType).toBeNull();
    });

    it('uppercases lowercase device-type input (ios -> IOS)', async () => {
      await service.createForUser(42, { deviceType: 'ios' } as any);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.deviceType).toBe('IOS');
    });

    it('omits device fields when deviceInfo is undefined', async () => {
      await service.createForUser(42, undefined);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update).not.toHaveProperty('deviceId');
      expect(update).not.toHaveProperty('userAgent');
    });
  });

  describe('active store resolution', () => {
    it('keeps defaultStoreFk when user has a role in that store', async () => {
      stubHappyPath({
        defaultStoreFk: 5,
        roles: [{ roleCode: 'OWNER', storeId: 5 }],
      });
      await service.createForUser(42, undefined);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.activeStoreFk).toBe(5);
    });

    it('clears activeStoreFk when user has no role in defaultStoreFk', async () => {
      stubHappyPath({
        defaultStoreFk: 5,
        roles: [{ roleCode: 'OWNER', storeId: 99 }],
      });
      await service.createForUser(42, undefined);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.activeStoreFk).toBeNull();
    });

    it('sets activeStoreFk to null when user has no defaultStoreFk', async () => {
      stubHappyPath({ defaultStoreFk: null });
      await service.createForUser(42, undefined);
      const update = sessionTokenRepo.updateByToken.mock.calls[0][1];
      expect(update.activeStoreFk).toBeNull();
    });
  });

  describe('failure paths', () => {
    it('throws InternalServerException when user has no guuid', async () => {
      permissions.getUserPermissions.mockResolvedValue({ roles: [] });
      usersRepo.findEmailAndGuuid.mockResolvedValue({ guuid: null });
      await expect(service.createForUser(42, undefined)).rejects.toThrow(InternalServerException);
    });

    it('throws InternalServerException when user lookup returns null', async () => {
      permissions.getUserPermissions.mockResolvedValue({ roles: [] });
      usersRepo.findEmailAndGuuid.mockResolvedValue(null);
      await expect(service.createForUser(42, undefined)).rejects.toThrow(InternalServerException);
    });

    it('throws InternalServerException when updateByToken returns null', async () => {
      stubHappyPath();
      sessionTokenRepo.updateByToken.mockResolvedValue(null);
      await expect(service.createForUser(42, undefined)).rejects.toThrow(InternalServerException);
    });

    it('propagates an exception from BetterAuth.createSession', async () => {
      authUtils.getBetterAuthContext.mockResolvedValue({
        internalAdapter: { createSession: jest.fn().mockRejectedValue(new Error('better-auth down')) },
      });
      await expect(service.createForUser(42, undefined)).rejects.toThrow('better-auth down');
    });
  });
});
