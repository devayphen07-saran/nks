import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { DbTransaction } from '../../../../../core/database/transaction.service';
import { SanitizerValidator } from '../../../../../common/validators/sanitizer.validator';
import { PasswordAuthValidator } from '../../validators';
import { LoginDto, RegisterDto } from '../../dto';
import type { AuthResponseEnvelope } from '../../dto';
import { executeAuthFlow } from '../orchestrators/auth-flow-orchestrator.service';
import { SessionCommandService } from '../session/session-command.service';
import { TokenService } from '../token/token.service';
import { PasswordService } from '../security/password.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionEvents } from '../../../../../common/events/session.events';
import { RoleQueryService } from '../../../roles/role-query.service';
import { RoleMutationService } from '../../../roles/role-mutation.service';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import {
  InternalServerException,
} from '../../../../../common/exceptions';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import { AccountSecurityPolicy } from '../../domain/account-security.policy';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

// Pre-computed once at module load — same cost as PasswordService.BCRYPT_ROUNDS.
// Used to normalize response time when the email is not found — prevents timing-based enumeration.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('__nks_timing_guard__', PasswordService.BCRYPT_ROUNDS);

type AuthUser = NonNullable<
  Awaited<ReturnType<AuthUsersRepository['findByEmail']>>
>;
type AuditMeta = { deviceId?: string; deviceType?: string };

/**
 * PasswordAuthService
 *
 * Owns email+password authentication flows:
 *   - login    — credential validation, brute-force protection, audit logging
 *   - register — user creation, initial role assignment
 *
 * Delegates the session + token + response pipeline to AuthFlowOrchestrator.
 */
@Injectable()
export class PasswordAuthService {
  private readonly logger = new Logger(PasswordAuthService.name);

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionCommandService,
    private readonly tokenService: TokenService,
    private readonly roleQuery: RoleQueryService,
    private readonly roleMutation: RoleMutationService,
    private readonly auditService: AuditCommandService,
    private readonly authUtils: AuthUtilsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async login(
    dto: LoginDto,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseEnvelope> {
    const auditMeta: AuditMeta = {
      deviceId: deviceInfo?.deviceId,
      deviceType: deviceInfo?.deviceType,
    };

    dto.email = SanitizerValidator.sanitizeEmail(dto.email);
    const record = await this.authUsersRepository.findByEmailWithPassword(
      dto.email,
    );

    if (!record) await this.runTimingGuard(dto.password);
    PasswordAuthValidator.assertUserFound(record);

    const { user, passwordHash } = record;

    this.checkBlockStatus(user, deviceInfo, auditMeta);
    await this.handleLockoutState(user, deviceInfo, auditMeta);

    // Email verification is NOT gated at login for mobile-first systems.
    // register() returns tokens immediately so users never had a prompt to verify;
    // blocking re-entry at login would permanently lock them out.
    // Sensitive endpoints (settings, payments) should check req.user.emailVerified
    // at the service level. The emailVerified flag is surfaced in AuthResponseEnvelope
    // and SessionUser so the client can show a "verify your email" prompt.

    const isValid = await this.passwordService.compare(
      dto.password,
      passwordHash,
    );
    if (!isValid) {
      await this.handleFailedPassword(user, deviceInfo, auditMeta);
    }

    await this.authUsersRepository.resetAndRecordLogin(user.id);

    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'User logged in via email',
      severity: 'info',
    });

    return executeAuthFlow(user, deviceInfo, this.sessionService, this.tokenService);
  }

  async register(
    dto: RegisterDto,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseEnvelope> {
    dto.email = SanitizerValidator.sanitizeEmail(dto.email);
    dto.firstName = SanitizerValidator.sanitizeName(dto.firstName);
    dto.lastName = SanitizerValidator.sanitizeName(dto.lastName);

    const existingUser = await this.authUsersRepository.findByEmail(dto.email);
    PasswordAuthValidator.assertEmailNotTaken(existingUser);

    const passwordHash = await this.passwordService.hash(dto.password);
    const iamUserId = crypto.randomUUID();

    const user = await this.authUsersRepository.createUserWithInitialRole(
      { iamUserId, firstName: dto.firstName, lastName: dto.lastName, email: dto.email, emailVerified: false },
      {
        providerId: 'email',
        accountId: dto.email,
        password: passwordHash,
        isVerified: false,
      },
      async (tx, userId) => {
        await this.assignInitialRoleInTransaction(userId, tx);
      },
    );

    PasswordAuthValidator.assertUserCreated(user);

    this.auditService.log({
      action: 'CREATE',
      userId: user.id,
      description: 'New user registered via email',
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: {
        deviceId: deviceInfo?.deviceId,
        deviceType: deviceInfo?.deviceType,
      },
      severity: 'info',
      resourceType: 'user',
      resourceId: user.id,
    });

    return executeAuthFlow(user, deviceInfo, this.sessionService, this.tokenService);
  }

  async isSuperAdminSeeded(): Promise<boolean> {
    const superAdminRoleId = await this.authUtils.getCachedSystemRoleId(
      SystemRoleCodes.SUPER_ADMIN,
    );
    if (!superAdminRoleId) return false;
    return this.roleQuery.hasUserWithRole(superAdminRoleId);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  // Prevents email enumeration via response-time difference when user is not found.
  private async runTimingGuard(password: string): Promise<void> {
    await this.passwordService.compare(password, DUMMY_BCRYPT_HASH);
  }

  private loginAuditBase(
    userId: number,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ) {
    return {
      action: 'LOGIN' as const,
      userId,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: auditMeta,
      resourceType: 'user' as const,
      resourceId: userId,
    };
  }

  private checkBlockStatus(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): void {
    if (!user.isBlocked) return;
    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'Login attempt - account is blocked',
      severity: 'warning',
    });
    PasswordAuthValidator.assertNotBlocked(user);
  }

  private async handleLockoutState(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): Promise<void> {
    if (!user.accountLockedUntil) return;

    if (AccountSecurityPolicy.isLocked(user.accountLockedUntil)) {
      this.auditService.log({
        ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
        description: 'Login attempt - account locked (brute-force)',
        severity: 'warning',
      });
      PasswordAuthValidator.assertNotLocked(user);
    } else {
      // Lock expired — CAS-safe auto-unlock: WHERE accountLockedUntil IS NOT NULL AND <= NOW()
      await this.authUsersRepository.autoUnlockIfExpired(user.id);
      this.auditService.log({
        ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
        action: 'ACCOUNT_UNBLOCKED',
        description: 'Account lockout expired — auto-unlocked on login attempt',
        severity: 'info',
      });
      this.logger.debug(`Auto-unlocked account for user ${user.id}`);
    }
  }

  private async handleFailedPassword(
    user: AuthUser,
    deviceInfo: DeviceInfo | undefined,
    auditMeta: AuditMeta,
  ): Promise<void> {
    const newFailedCount = await this.authUsersRepository.incrementFailedAttempts(user.id);
    const shouldLock = AccountSecurityPolicy.shouldLock(newFailedCount);

    if (shouldLock) {
      await this.authUsersRepository.lockAccount(user.id, AccountSecurityPolicy.lockoutExpiry());
      // Revoke existing sessions off the hot path — the lockout is already
      // committed, so new logins are blocked before the listener fires.
      this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
        userId: user.id,
        reason: 'ACCOUNT_LOCKED',
      });
    }

    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'Login attempt - invalid password',
      severity: 'warning',
      metadata: {
        ...auditMeta,
        failedAttempts: newFailedCount,
        accountLocked: shouldLock,
      },
    });
    PasswordAuthValidator.assertPasswordValid(false);
  }

  private async assignInitialRoleInTransaction(
    userId: number,
    tx: DbTransaction,
  ): Promise<void> {
    try {
      const superAdminRoleId = await this.authUtils.getCachedSystemRoleId(
        SystemRoleCodes.SUPER_ADMIN,
      );
      if (!superAdminRoleId) {
        this.logger.error(
          'SUPER_ADMIN system role not seeded — cannot assign initial role. Run DB seed before accepting registrations.',
        );
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
      }
      const roleCode =
        await this.roleMutation.resolveInitialRoleWithinTransaction(
          tx,
          superAdminRoleId,
        );
      const assigned = await this.roleMutation.assignRoleWithinTransaction(
        tx,
        userId,
        roleCode,
      );
      if (!assigned)
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
    } catch (err) {
      this.logger.error(
        `assignInitialRoleInTransaction failed for userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
