import * as crypto from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../core/database/schema';
import { SanitizerValidator } from '../../../../common/validators/sanitizer.validator';
import { LoginDto, RegisterDto } from '../../dto';
import type { AuthResponseEnvelope } from '../../dto';
import { AuthFlowOrchestrator } from '../orchestrators/auth-flow-orchestrator.service';
import { PasswordService } from '../security/password.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { AuthProviderRepository } from '../../repositories/auth-provider.repository';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import { AuditService, AuditEventType } from '../../../audit/audit.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { fireAndForgetWithRetry } from '../../../../common/utils/retry';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

type DeviceInfo = {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  appVersion?: string;
  ipAddress?: string;
  userAgent?: string;
};

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
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly passwordService: PasswordService,
    private readonly authFlowOrchestrator: AuthFlowOrchestrator,
    private readonly rolesRepository: RolesRepository,
    private readonly auditService: AuditService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  async login(dto: LoginDto, deviceInfo?: DeviceInfo): Promise<AuthResponseEnvelope> {
    const auditMeta = { deviceId: deviceInfo?.deviceId, deviceType: deviceInfo?.deviceType };

    const user = await this.authUsersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: ErrorMessages[ErrorCodes.AUTH_INVALID_CREDENTIALS] });

    if (user.isBlocked) {
      fireAndForgetWithRetry(() => this.auditService.log({
        eventType: AuditEventType.LOGIN,
        userId: user.id,
        description: 'Login attempt - account is blocked',
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        metadata: auditMeta,
        severity: 'warning',
        resourceType: 'user',
        resourceId: user.id,
      }));
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_ACCOUNT_BLOCKED, message: ErrorMessages[ErrorCodes.AUTH_ACCOUNT_BLOCKED] });
    }

    if (user.accountLockedUntil) {
      const now = new Date();
      if (user.accountLockedUntil > now) {
        fireAndForgetWithRetry(() => this.auditService.log({
          eventType: AuditEventType.LOGIN,
          userId: user.id,
          description: 'Login attempt - account locked (brute-force)',
          ipAddress: deviceInfo?.ipAddress,
          userAgent: deviceInfo?.userAgent,
          metadata: auditMeta,
          severity: 'warning',
          resourceType: 'user',
          resourceId: user.id,
        }));
        throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_ACCOUNT_LOCKED, message: ErrorMessages[ErrorCodes.AUTH_ACCOUNT_LOCKED] });
      } else {
        // Lock expired — auto-unlock
        const unlocked = await this.authUsersRepository.update(user.id, {
          accountLockedUntil: null,
          failedLoginAttempts: 0,
        });
        if (!unlocked)
          throw new InternalServerErrorException({ errorCode: ErrorCodes.GEN_INTERNAL_ERROR, message: ErrorMessages[ErrorCodes.GEN_INTERNAL_ERROR] });
        this.logger.log(`Auto-unlocked account for user ${user.id}`);
      }
    }

    const provider = await this.authProviderRepository.findByUserIdAndProvider(
      user.id,
      'email',
    );
    if (!provider?.password) throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: ErrorMessages[ErrorCodes.AUTH_INVALID_CREDENTIALS] });

    const isValid = await this.passwordService.compare(dto.password, provider.password);
    if (!isValid) {
      const newFailedCount = user.failedLoginAttempts + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;
      const updated = await this.authUsersRepository.update(user.id, {
        failedLoginAttempts: newFailedCount,
        ...(shouldLock
          ? { accountLockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }
          : {}),
      });
      if (!updated)
        throw new InternalServerErrorException({ errorCode: ErrorCodes.GEN_INTERNAL_ERROR, message: ErrorMessages[ErrorCodes.GEN_INTERNAL_ERROR] });
      fireAndForgetWithRetry(() => this.auditService.log({
        eventType: AuditEventType.LOGIN,
        userId: user.id,
        description: 'Login attempt - invalid password',
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        metadata: { ...auditMeta, failedAttempts: newFailedCount, accountLocked: shouldLock },
        severity: 'warning',
        resourceType: 'user',
        resourceId: user.id,
      }));
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: ErrorMessages[ErrorCodes.AUTH_INVALID_CREDENTIALS] });
    }

    const loginReset = await this.authUsersRepository.update(user.id, {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastActiveAt: new Date(),
    });
    if (!loginReset) throw new InternalServerErrorException({ errorCode: ErrorCodes.GEN_INTERNAL_ERROR, message: ErrorMessages[ErrorCodes.GEN_INTERNAL_ERROR] });
    await this.authUsersRepository.recordLogin(user.id);

    fireAndForgetWithRetry(() => this.auditService.log({
      eventType: AuditEventType.LOGIN,
      userId: user.id,
      description: 'User logged in via email',
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: auditMeta,
      severity: 'info',
      resourceType: 'user',
      resourceId: user.id,
    }));

    return this.authFlowOrchestrator.executeAuthFlow(user, deviceInfo);
  }

  async register(dto: RegisterDto, deviceInfo?: DeviceInfo): Promise<AuthResponseEnvelope> {
    dto.email = SanitizerValidator.sanitizeEmail(dto.email);
    dto.name = SanitizerValidator.sanitizeName(dto.name);

    const existingUser = await this.authUsersRepository.findByEmail(dto.email);
    if (existingUser) throw new ConflictException({ errorCode: ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE, message: ErrorMessages[ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE] });

    const passwordHash = await this.passwordService.hash(dto.password);
    const iamUserId = crypto.randomUUID();

    const user = await this.authUsersRepository.createUserWithInitialRole(
      { iamUserId, name: dto.name, email: dto.email, emailVerified: false },
      { providerId: 'email', accountId: dto.email, password: passwordHash, isVerified: false },
      async (tx, userId) => {
        await this.assignInitialRoleInTransaction(userId, tx);
      },
    );

    if (!user) throw new ConflictException({ errorCode: ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE, message: ErrorMessages[ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE] });

    return this.authFlowOrchestrator.executeAuthFlow(user, deviceInfo);
  }

  async isSuperAdminSeeded(): Promise<boolean> {
    const superAdminRoleId = await this.authUtils.getCachedSystemRoleId('SUPER_ADMIN');
    if (!superAdminRoleId) return false;
    return this.rolesRepository.hasUserWithRole(superAdminRoleId);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async assignInitialRoleInTransaction(
    userId: number,
    tx: NodePgDatabase<typeof schema>,
  ): Promise<void> {
    try {
      const superAdminRoleId = await this.authUtils.getCachedSystemRoleId('SUPER_ADMIN');
      if (!superAdminRoleId) {
        this.logger.warn('SUPER_ADMIN system role not found in DB');
        return;
      }
      const roleCode = await this.rolesRepository.resolveInitialRoleWithinTransaction(
        tx,
        superAdminRoleId,
      );
      await this.rolesRepository.assignRoleWithinTransaction(tx, userId, roleCode);
    } catch (err) {
      this.logger.error(
        `assignInitialRoleInTransaction failed for userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

}
