import { Test, TestingModule } from '@nestjs/testing';
import { AuthUtilsService } from './auth-utils.service';
import { RoleQueryService } from '../../../roles/role-query.service';
import { BETTER_AUTH_TOKEN } from '../../auth.constants';

describe('AuthUtilsService', () => {
  let service: AuthUtilsService;
  let roleQuery: { findSystemRoleId: jest.Mock };

  beforeEach(async () => {
    roleQuery = { findSystemRoleId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthUtilsService,
        { provide: RoleQueryService, useValue: roleQuery },
        { provide: BETTER_AUTH_TOKEN, useValue: { $context: Promise.resolve({ internalAdapter: {} }) } },
      ],
    }).compile();

    service = module.get<AuthUtilsService>(AuthUtilsService);
  });

  describe('getCachedSystemRoleId', () => {
    it('queries repository on first lookup', async () => {
      roleQuery.findSystemRoleId.mockResolvedValue(7);
      const result = await service.getCachedSystemRoleId('STORE_OWNER');
      expect(result).toBe(7);
      expect(roleQuery.findSystemRoleId).toHaveBeenCalledWith('STORE_OWNER');
    });

    it('returns cached value on subsequent lookups (no repo call)', async () => {
      roleQuery.findSystemRoleId.mockResolvedValue(7);
      await service.getCachedSystemRoleId('STORE_OWNER');
      await service.getCachedSystemRoleId('STORE_OWNER');
      await service.getCachedSystemRoleId('STORE_OWNER');
      expect(roleQuery.findSystemRoleId).toHaveBeenCalledTimes(1);
    });

    it('caches null result so missing roles are not re-queried', async () => {
      roleQuery.findSystemRoleId.mockResolvedValue(null);
      expect(await service.getCachedSystemRoleId('MISSING')).toBeNull();
      expect(await service.getCachedSystemRoleId('MISSING')).toBeNull();
      expect(roleQuery.findSystemRoleId).toHaveBeenCalledTimes(1);
    });

    it('caches separate entries per role code', async () => {
      roleQuery.findSystemRoleId
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
      expect(await service.getCachedSystemRoleId('A')).toBe(1);
      expect(await service.getCachedSystemRoleId('B')).toBe(2);
      expect(await service.getCachedSystemRoleId('A')).toBe(1);
      expect(await service.getCachedSystemRoleId('B')).toBe(2);
      expect(roleQuery.findSystemRoleId).toHaveBeenCalledTimes(2);
    });
  });

});
