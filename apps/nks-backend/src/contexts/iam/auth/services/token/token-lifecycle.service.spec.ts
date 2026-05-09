import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { TokenLifecycleService } from './token-lifecycle.service';
import { JWTConfigService } from '../../../../../config/jwt.config';
import { TokenService } from './token.service';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { TokenTheftDetectionService } from './token-theft-detection.service';
import { RateLimitService } from '../../../../../common/guards/services/rate-limit.service';
import {
  UnauthorizedException,
  TooManyRequestsException,
  InternalServerException,
} from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';

const VALID_REFRESH = 'valid-refresh-token';
const VALID_HASH = crypto.createHash('sha256').update(VALID_REFRESH).digest('hex');

const buildSession = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 42,
  guuid: 'session-guuid',
  token: 'session-token',
  csrfSecret: 'csrf-secret',
  refreshTokenHash: VALID_HASH,
  refreshTokenRevokedAt: null,
  refreshTokenExpiresAt: new Date(Date.now() + 60_000),
  expiresAt: new Date(Date.now() + 3_600_000),
  deviceId: null,
  activeStoreFk: null,
  ...overrides,
});

const buildUser = (overrides: Partial<any> = {}) => ({
  guuid: 'user-guuid',
  iamUserId: 'iam-1',
  email: 'a@b.com',
  firstName: 'A',
  lastName: 'B',
  phoneNumber: null,
  defaultStoreFk: null,
  ...overrides,
});

describe('TokenLifecycleService', () => {
  let service: TokenLifecycleService;
  let jwt: { signToken: jest.Mock };
  let tokenSvc: { verifyRefreshTokenHash: jest.Mock; generateRefreshToken: jest.Mock };
  let sessionRepo: { findByRefreshTokenHashForUpdate: jest.Mock; rotateRefreshTokenInPlace: jest.Mock };
  let usersRepo: { findEmailAndGuuid: jest.Mock };
  let roleQuery: { findPrimaryStoreForUser: jest.Mock };
  let permissions: { getUserPermissions: jest.Mock };
  let authUtils: { getCachedSystemRoleId: jest.Mock };
  let theftService: { detectAndHandleTheft: jest.Mock };
  let rateLimit: { recordHit: jest.Mock };

  beforeEach(async () => {
    jwt = { signToken: jest.fn().mockReturnValue('access-jwt') };
    tokenSvc = {
      verifyRefreshTokenHash: jest.fn().mockReturnValue(true),
      generateRefreshToken: jest.fn().mockReturnValue({
        token: 'new-refresh',
        tokenHash: 'new-hash',
      }),
    };
    sessionRepo = {
      findByRefreshTokenHashForUpdate: jest.fn(),
      rotateRefreshTokenInPlace: jest.fn().mockResolvedValue(true),
    };
    usersRepo = { findEmailAndGuuid: jest.fn().mockResolvedValue(buildUser()) };
    roleQuery = { findPrimaryStoreForUser: jest.fn().mockResolvedValue(null) };
    permissions = { getUserPermissions: jest.fn().mockResolvedValue({ roles: [] }) };
    authUtils = { getCachedSystemRoleId: jest.fn().mockResolvedValue(null) };
    theftService = { detectAndHandleTheft: jest.fn().mockReturnValue(false) };
    rateLimit = { recordHit: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenLifecycleService,
        { provide: JWTConfigService, useValue: jwt },
        { provide: TokenService, useValue: tokenSvc },
        { provide: SessionTokenRepository, useValue: sessionRepo },
        { provide: AuthUsersRepository, useValue: usersRepo },
        { provide: RoleQueryService, useValue: roleQuery },
        { provide: PermissionsService, useValue: permissions },
        { provide: AuthUtilsService, useValue: authUtils },
        { provide: TokenTheftDetectionService, useValue: theftService },
        { provide: RateLimitService, useValue: rateLimit },
      ],
    }).compile();

    service = module.get<TokenLifecycleService>(TokenLifecycleService);
  });

  describe('input validation', () => {
    it('throws AUTH_REFRESH_TOKEN_INVALID for empty refresh token', async () => {
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(''); } catch (e) { err = e as any; }
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    });

    it('throws AUTH_REFRESH_TOKEN_INVALID for oversized refresh token', async () => {
      const long = 'a'.repeat(513);
      await expect(service.refreshAccessToken(long)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('session lookup and validation', () => {
    it('throws when session not found by hash', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(null);
      await expect(service.refreshAccessToken(VALID_REFRESH)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when stored hash does not match incoming token', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      tokenSvc.verifyRefreshTokenHash.mockReturnValue(false);
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    });

    it('throws AUTH_SESSION_EXPIRED when session is past expiry', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(
        buildSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_EXPIRED);
    });

    it('throws AUTH_REFRESH_TOKEN_EXPIRED when refresh expiry passed', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(
        buildSession({ refreshTokenExpiresAt: new Date(Date.now() - 1000) }),
      );
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED);
    });
  });

  describe('device binding', () => {
    it('passes when session has no deviceId', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession({ deviceId: null }));
      const result = await service.refreshAccessToken(VALID_REFRESH, 'device-1');
      expect(result.csrfSecret).toBe('csrf-secret');
    });

    it('passes when device IDs match', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession({ deviceId: 'device-1' }));
      const result = await service.refreshAccessToken(VALID_REFRESH, 'device-1');
      expect(result.csrfSecret).toBe('csrf-secret');
    });

    it('throws AUTH_DEVICE_MISMATCH when device IDs differ', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession({ deviceId: 'device-1' }));
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH, 'device-2'); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_DEVICE_MISMATCH);
    });
  });

  describe('rate limiting', () => {
    it('throws TooManyRequestsException when per-user limit exceeded', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      rateLimit.recordHit.mockResolvedValue(9999);
      await expect(service.refreshAccessToken(VALID_REFRESH)).rejects.toThrow(TooManyRequestsException);
    });

    it('uses per-user rate limit key (not per-IP)', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      await service.refreshAccessToken(VALID_REFRESH);
      const key = rateLimit.recordHit.mock.calls[0][0];
      expect(key).toBe('rl:user-refresh:42');
    });
  });

  describe('theft detection', () => {
    it('throws AUTH_SESSION_COMPROMISED when theft detected', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(
        buildSession({ refreshTokenRevokedAt: new Date() }),
      );
      theftService.detectAndHandleTheft.mockReturnValue(true);
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_COMPROMISED);
    });
  });

  describe('CAS rotation', () => {
    it('throws AUTH_REFRESH_TOKEN_INVALID when rotation race lost (rotated=false)', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      sessionRepo.rotateRefreshTokenInPlace.mockResolvedValue(false);
      let err: UnauthorizedException | undefined;
      try { await service.refreshAccessToken(VALID_REFRESH); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    });

    it('signs JWT only after rotation succeeds (no orphaned tokens)', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      sessionRepo.rotateRefreshTokenInPlace.mockResolvedValue(false);
      try { await service.refreshAccessToken(VALID_REFRESH); } catch { /* expected */ }
      expect(jwt.signToken).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('returns envelope and csrfSecret on success', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      const result = await service.refreshAccessToken(VALID_REFRESH);
      expect(result.csrfSecret).toBe('csrf-secret');
      expect(result.envelope).toBeDefined();
      expect(jwt.signToken).toHaveBeenCalledTimes(1);
      expect(sessionRepo.rotateRefreshTokenInPlace).toHaveBeenCalledTimes(1);
    });

    it('clears activeStoreFk when user has no role in that store', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(
        buildSession({ activeStoreFk: 99 }),
      );
      permissions.getUserPermissions.mockResolvedValue({ roles: [{ storeId: 5 }] });
      await service.refreshAccessToken(VALID_REFRESH);
      const updates = sessionRepo.rotateRefreshTokenInPlace.mock.calls[0][2];
      expect(updates.activeStoreFk).toBeNull();
    });

    it('preserves activeStoreFk when user still has a role in that store', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(
        buildSession({ activeStoreFk: 5 }),
      );
      permissions.getUserPermissions.mockResolvedValue({ roles: [{ storeId: 5 }] });
      await service.refreshAccessToken(VALID_REFRESH);
      const updates = sessionRepo.rotateRefreshTokenInPlace.mock.calls[0][2];
      expect(updates.activeStoreFk).toBe(5);
    });

    it('throws InternalServerException when user lookup returns no guuid', async () => {
      sessionRepo.findByRefreshTokenHashForUpdate.mockResolvedValue(buildSession());
      usersRepo.findEmailAndGuuid.mockResolvedValue({ guuid: null });
      await expect(service.refreshAccessToken(VALID_REFRESH)).rejects.toThrow(InternalServerException);
    });
  });
});