import { Injectable, Logger } from '@nestjs/common';
import { InternalServerException } from '../../../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import * as crypto from 'crypto';
import type { DbTransaction } from '../../../../../core/database/transaction.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { RoleCommandService } from '../../../roles/role-command.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { UserCreationValidator } from '../../validators';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import { SanitizerValidator } from '../../../../../common/validators/sanitizer.validator';
import * as schema from '../../../../../core/database/schema';
import type { NewUser } from '../../../../../core/database/schema/auth/users';

type DbUser = typeof schema.users.$inferSelect;

/**
 * UserCreationService
 * Handles user find/create logic — separated from OTP verification for SRP.
 *
 * ARCHITECTURE:
 * - OtpService: Pure OTP verification only (verify token with MSG91)
 * - UserCreationService: User find/create logic (no OTP knowledge)
 * - OtpAuthOrchestrator: Orchestrates full flow (verify OTP → find/create user → create session)
 */
@Injectable()
export class UserCreationService {
  private readonly logger = new Logger(UserCreationService.name);

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly roleQuery: RoleQueryService,
    private readonly roleMutation: RoleCommandService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  /**
   * Find or create user by phone number (after OTP verification confirms ownership).
   * Phone is guaranteed to be verified by MSG91 before calling this.
   *
   * IMPORTANT: OTP users can only be created AFTER a SUPER_ADMIN exists.
   * The first SUPER_ADMIN must be created via email/password registration.
   * OTP users always get the USER role.
   */
  async findOrCreateByPhone(phone: string): Promise<DbUser> {
    const normalizedPhone = SanitizerValidator.sanitizePhoneNumber(phone);
    return this.findOrCreate({
      channel: 'phone OTP',
      maskedIdentifier: normalizedPhone.slice(-4),
      find: () => this.authUsersRepository.findByPhone(normalizedPhone),
      buildPayload: () => ({
        firstName: 'User',
        lastName: normalizedPhone.slice(-4),
        phoneNumber: normalizedPhone,
        phoneNumberVerified: true,
        iamUserId: crypto.randomUUID(),
      }),
      isVerified: (u) => u.phoneNumberVerified,
      verify: (id) => this.authUsersRepository.verifyPhone(id),
    });
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Shared find-or-create flow used by both phone and email entry points.
   */
  private async findOrCreate(opts: {
    channel: 'phone OTP' | 'email OTP';
    maskedIdentifier: string;
    find: () => Promise<DbUser | null>;
    buildPayload: () => NewUser;
    isVerified: (u: DbUser) => boolean;
    verify: (id: number) => Promise<void>;
  }): Promise<DbUser> {
    let user = await opts.find();

    if (!user) {
      await this.ensureSuperAdminExists();

      user = await this.authUsersRepository.createUserWithInitialRole(
        opts.buildPayload(),
        null,
        null,
        (tx, userId) => this.assignUserRole(tx, userId),
      );

      // Race-safe: createUserWithInitialRole returns null when a concurrent
      // request hit the unique constraint first. Re-fetch the winner's row.
      if (!user) {
        user = await opts.find();
        if (!user) {
          this.logger.error(
            `Race resolution failed for ${opts.channel} (${opts.maskedIdentifier}) — create and re-fetch both returned null`,
          );
          throw new InternalServerException(
            errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
          );
        }
      }

      UserCreationValidator.assertUserCreated(user);
      this.logger.log(`New user created via ${opts.channel}: ${user.id}`);
    }

    if (!opts.isVerified(user)) {
      try {
        await opts.verify(user.id);
      } catch (err) {
        this.logger.error(
          `Verify failed for ${opts.channel} (userId=${user.id}, ${opts.maskedIdentifier}); retryable on next OTP`,
          err instanceof Error ? err.stack : String(err),
        );
        throw err;
      }
      // Re-fetch to stay in sync with DB state (updatedAt, triggers, etc.).
      const refreshed = await opts.find();
      if (refreshed) user = refreshed;
      this.logger.log(
        `Verified ${opts.channel} for user ${user.id}: ${opts.maskedIdentifier}`,
      );
    }

    return user;
  }

  /**
   * Guard: Reject registration if no SUPER_ADMIN exists yet.
   * The first admin must be created via email/password registration.
   */
  private async ensureSuperAdminExists(): Promise<void> {
    const superAdminRoleId = await this.authUtils.getCachedSystemRoleId(
      SystemRoleCodes.SUPER_ADMIN,
    );
    if (!superAdminRoleId) {
      this.logger.error(
        'SUPER_ADMIN system role not found — run db:seed before accepting registrations',
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }

    const exists = await this.roleQuery.hasSuperAdmin(superAdminRoleId);
    UserCreationValidator.assertAdminExists(exists);
  }

  /**
   * Assign the default USER role within the creation transaction.
   * OTP-registered users never receive SUPER_ADMIN.
   */
  private async assignUserRole(
    tx: DbTransaction,
    userId: number,
  ): Promise<void> {
    const assigned = await this.roleMutation.assignRoleWithinTransaction(
      tx,
      userId,
      SystemRoleCodes.USER,
    );
    if (!assigned) {
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }
}
