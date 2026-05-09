import { Test, TestingModule } from '@nestjs/testing';
import { PasswordAuthService } from './password-auth.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PasswordService } from '../security/password.service';
import { AuthFlowOrchestratorService } from '../orchestrators/auth-flow-orchestrator.service';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { AccountSecurityService } from './account-security.service';
import { InitialRoleAssignmentService } from './initial-role-assignment.service';
import {
  UnauthorizedException,
  ConflictException,
} from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';

const buildUser = (overrides: Partial<any> = {}) => ({
  id: 42,
  guuid: 'user-guuid',
  iamUserId: 'iam-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  isBlocked: false,
  accountLockedUntil: null,
  ...overrides,
});

const fakeAuthResult = { envelope: {}, csrfSecret: 'csrf' } as any;

describe('PasswordAuthService', () => {
  let service: PasswordAuthService;
  let authUsersRepo: { findByEmailWithPassword: jest.Mock; findByEmail: jest.Mock; createUserWithInitialRole: jest.Mock; resetAndRecordLogin: jest.Mock };
  let passwordService: { compare: jest.Mock; hash: jest.Mock; hashRaw: jest.Mock };
  let authFlow: { execute: jest.Mock };
  let auditService: { log: jest.Mock };
  let accountSecurity: { checkBlockStatus: jest.Mock; handleLockoutState: jest.Mock; handleFailedPassword: jest.Mock };
  let initialRoleAssignment: { assignInitialRoleInTransaction: jest.Mock };

  beforeEach(async () => {
    authUsersRepo = {
      findByEmailWithPassword: jest.fn(),
      findByEmail: jest.fn(),
      createUserWithInitialRole: jest.fn(),
      resetAndRecordLogin: jest.fn().mockResolvedValue(undefined),
    };
    passwordService = {
      compare: jest.fn(),
      hash: jest.fn().mockResolvedValue('hashed-pw'),
      hashRaw: jest.fn().mockResolvedValue('dummy-bcrypt-hash'),
    };
    authFlow = { execute: jest.fn().mockResolvedValue(fakeAuthResult) };
    auditService = { log: jest.fn() };
    accountSecurity = {
      checkBlockStatus: jest.fn(),
      handleLockoutState: jest.fn().mockResolvedValue(undefined),
      handleFailedPassword: jest.fn().mockImplementation(() => {
        throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS });
      }),
    };
    initialRoleAssignment = { assignInitialRoleInTransaction: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordAuthService,
        { provide: AuthUsersRepository, useValue: authUsersRepo },
        { provide: PasswordService, useValue: passwordService },
        { provide: AuthFlowOrchestratorService, useValue: authFlow },
        { provide: AuditCommandService, useValue: auditService },
        { provide: AccountSecurityService, useValue: accountSecurity },
        { provide: InitialRoleAssignmentService, useValue: initialRoleAssignment },
      ],
    }).compile();

    service = module.get<PasswordAuthService>(PasswordAuthService);
    await service.onModuleInit();
  });

  describe('login', () => {
    it('returns envelope and csrfSecret on the happy path', async () => {
      const user = buildUser();
      authUsersRepo.findByEmailWithPassword.mockResolvedValue({ user, passwordHash: 'stored-hash' });
      passwordService.compare.mockResolvedValue(true);

      const result = await service.login({ email: 'ada@example.com', password: 'pw' } as any);
      expect(result).toBe(fakeAuthResult);
      expect(authFlow.execute).toHaveBeenCalledWith(user, undefined);
    });

    it('sanitizes the email (trim+lowercase) before lookup', async () => {
      authUsersRepo.findByEmailWithPassword.mockResolvedValue(null);
      try {
        await service.login({ email: '  ADA@Example.COM  ', password: 'pw' } as any);
      } catch { /* expected */ }
      expect(authUsersRepo.findByEmailWithPassword).toHaveBeenCalledWith('ada@example.com');
    });

    it('runs timing guard and throws INVALID_CREDENTIALS when user not found', async () => {
      authUsersRepo.findByEmailWithPassword.mockResolvedValue(null);
      let err: UnauthorizedException | undefined;
      try { await service.login({ email: 'no@one.com', password: 'pw' } as any); } catch (e) { err = e as any; }
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(passwordService.compare).toHaveBeenCalledWith('pw', 'dummy-bcrypt-hash');
    });

    it('runs timing guard for phone-only user (passwordHash null) — no oracle leak', async () => {
      authUsersRepo.findByEmailWithPassword.mockResolvedValue({ user: buildUser(), passwordHash: null });
      try { await service.login({ email: 'ada@example.com', password: 'pw' } as any); } catch { /* expected */ }
      expect(passwordService.compare).toHaveBeenCalledWith('pw', 'dummy-bcrypt-hash');
    });

    it('delegates blocked-status check before password compare', async () => {
      const user = buildUser({ isBlocked: true });
      accountSecurity.checkBlockStatus.mockImplementation(() => {
        throw new UnauthorizedException({ errorCode: ErrorCode.USER_BLOCKED });
      });
      authUsersRepo.findByEmailWithPassword.mockResolvedValue({ user, passwordHash: 'h' });

      await expect(service.login({ email: 'a@b.com', password: 'p' } as any)).rejects.toThrow(UnauthorizedException);
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('calls handleFailedPassword and bubbles its exception when password mismatches', async () => {
      authUsersRepo.findByEmailWithPassword.mockResolvedValue({ user: buildUser(), passwordHash: 'h' });
      passwordService.compare.mockResolvedValue(false);
      await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any)).rejects.toThrow(UnauthorizedException);
      expect(accountSecurity.handleFailedPassword).toHaveBeenCalled();
      expect(authUsersRepo.resetAndRecordLogin).not.toHaveBeenCalled();
    });

    it('records login + emits audit log on success', async () => {
      authUsersRepo.findByEmailWithPassword.mockResolvedValue({ user: buildUser(), passwordHash: 'h' });
      passwordService.compare.mockResolvedValue(true);
      await service.login({ email: 'a@b.com', password: 'p' } as any, { ipAddress: '1.2.3.4', userAgent: 'ua' } as any);
      expect(authUsersRepo.resetAndRecordLogin).toHaveBeenCalledWith(42);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LOGIN',
        userId: 42,
        ipAddress: '1.2.3.4',
        severity: 'info',
      }));
    });
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      authUsersRepo.findByEmail.mockResolvedValue({ id: 1 });
      await expect(service.register({
        email: 'ada@b.com', password: 'StrongPass1!', firstName: 'A', lastName: 'B',
      } as any)).rejects.toThrow(ConflictException);
    });

    it('hashes the password before creating the user', async () => {
      authUsersRepo.findByEmail.mockResolvedValue(null);
      authUsersRepo.createUserWithInitialRole.mockResolvedValue(buildUser());
      await service.register({
        email: 'a@b.com', password: 'StrongPass1!', firstName: 'a', lastName: 'b',
      } as any);
      expect(passwordService.hash).toHaveBeenCalledWith('StrongPass1!');
      expect(authUsersRepo.createUserWithInitialRole).toHaveBeenCalled();
    });

    it('sanitizes email, firstName, lastName before persistence', async () => {
      authUsersRepo.findByEmail.mockResolvedValue(null);
      authUsersRepo.createUserWithInitialRole.mockResolvedValue(buildUser());
      await service.register({
        email: '  ADA@b.com', password: 'StrongPass1!', firstName: 'ada', lastName: 'lovelace',
      } as any);
      expect(authUsersRepo.findByEmail).toHaveBeenCalledWith('ada@b.com');
      const userData = authUsersRepo.createUserWithInitialRole.mock.calls[0][0];
      expect(userData.firstName).toBe('Ada');
      expect(userData.lastName).toBe('Lovelace');
    });

    it('records audit log + delegates to authFlow.execute on success', async () => {
      const user = buildUser();
      authUsersRepo.findByEmail.mockResolvedValue(null);
      authUsersRepo.createUserWithInitialRole.mockResolvedValue(user);
      await service.register({
        email: 'a@b.com', password: 'StrongPass1!', firstName: 'a', lastName: 'b',
      } as any);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE',
        userId: 42,
        resourceType: 'user',
      }));
      expect(authFlow.execute).toHaveBeenCalledWith(user, undefined);
    });

    it('throws when createUserWithInitialRole returns null (race-loss)', async () => {
      authUsersRepo.findByEmail.mockResolvedValue(null);
      authUsersRepo.createUserWithInitialRole.mockResolvedValue(null);
      await expect(service.register({
        email: 'a@b.com', password: 'StrongPass1!', firstName: 'a', lastName: 'b',
      } as any)).rejects.toThrow(ConflictException);
    });
  });
});
