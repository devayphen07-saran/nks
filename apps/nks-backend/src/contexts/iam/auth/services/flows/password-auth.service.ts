import * as crypto from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SanitizerValidator } from '../../../../../common/validators/sanitizer.validator';
import { PasswordAuthValidator } from '../../validators';
import { UnauthorizedException } from '../../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../../common/constants/error-codes.constants';
import { LoginDto, RegisterDto } from '../../dto';
import type { AuthResponseEnvelope } from '../../dto';
import { AuthFlowOrchestratorService } from '../orchestrators/auth-flow-orchestrator.service';
import { PasswordService } from '../security/password.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { AccountSecurityService } from './account-security.service';
import { InitialRoleAssignmentService } from './initial-role-assignment.service';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

type AuditMeta = { deviceId?: string; deviceType?: string };

/**
 * PasswordAuthService
 *
 * Owns email+password authentication flows:
 *   - login    — credential validation, brute-force protection (delegates to AccountSecurityService)
 *   - register — user creation, initial role assignment (delegates to InitialRoleAssignmentService)
 *
 * Delegates the session + token + response pipeline to AuthFlowOrchestrator.
 *
 * Dependencies (8):
 *   - authUsersRepository (user CRUD, reset login state)
 *   - passwordService (hash and compare)
 *   - authFlow (session + token + response envelope)
 *   - authUtils (system role caching)
 *   - auditService (login audit logging)
 *   - roleQuery (first-user SUPER_ADMIN check)
 *   - accountSecurityService (lockout, brute-force, auto-unlock)
 *   - initialRoleAssignmentService (role assignment on register)
 */
@Injectable()
export class PasswordAuthService implements OnModuleInit {
  private readonly logger = new Logger(PasswordAuthService.name);

  // Computed in onModuleInit so the cost factor matches PasswordService's configured BCRYPT_ROUNDS.
  // Used to normalize response time when the email is not found — prevents timing-based enumeration.
  private dummyBcryptHash!: string;

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly passwordService: PasswordService,
    private readonly authFlow: AuthFlowOrchestratorService,
    private readonly auditService: AuditCommandService,
    private readonly accountSecurityService: AccountSecurityService,
    private readonly initialRoleAssignmentService: InitialRoleAssignmentService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyBcryptHash = await this.passwordService.hashRaw('__nks_timing_guard__');
  }

  async login(
    dto: LoginDto,
    deviceInfo?: DeviceInfo,
  ): Promise<{ envelope: AuthResponseEnvelope; csrfSecret: string }> {
    const auditMeta: AuditMeta = {
      deviceId: deviceInfo?.deviceId,
      deviceType: deviceInfo?.deviceType,
    };

    dto.email = SanitizerValidator.sanitizeEmail(dto.email);
    const record = await this.authUsersRepository.findByEmailWithPassword(
      dto.email,
    );

    // Phone-only users (OTP-onboarded, no email auth_provider) come back from the
    // LEFT JOIN with passwordHash=null. Treat them identically to "email not found":
    // run the timing guard, then throw INVALID_CREDENTIALS. Without this branch,
    // bcrypt.compare(plaintext, null) either rejects (node-bcrypt) → 500 leak, or
    // returns false (bcryptjs) → silent oracle that distinguishes phone-only
    // accounts from non-existent ones via downstream behaviour.
    if (!record || !record.passwordHash) {
      await this.runTimingGuard(dto.password);
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_INVALID_CREDENTIALS));
    }

    const { user, passwordHash } = record;

    this.accountSecurityService.checkBlockStatus(user, deviceInfo, auditMeta);
    await this.accountSecurityService.handleLockoutState(user, deviceInfo, auditMeta);

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
      await this.accountSecurityService.handleFailedPassword(user, deviceInfo, auditMeta);
    }

    await this.authUsersRepository.resetAndRecordLogin(user.id);

    this.auditService.log({
      ...this.loginAuditBase(user.id, deviceInfo, auditMeta),
      description: 'User logged in via email',
      severity: 'info',
    });

    return this.authFlow.execute(user, deviceInfo);
  }

  async register(
    dto: RegisterDto,
    deviceInfo?: DeviceInfo,
  ): Promise<{ envelope: AuthResponseEnvelope; csrfSecret: string }> {
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
      null, // self-registration — no logged-in actor exists
      async (tx, userId) => {
        await this.initialRoleAssignmentService.assignInitialRoleInTransaction(userId, tx);
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

    return this.authFlow.execute(user, deviceInfo);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  // Prevents email enumeration via response-time difference when user is not found.
  private async runTimingGuard(password: string): Promise<void> {
    await this.passwordService.compare(password, this.dummyBcryptHash);
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
}
