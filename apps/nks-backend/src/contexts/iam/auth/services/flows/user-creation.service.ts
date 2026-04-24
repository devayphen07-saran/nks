import { Injectable, Logger } from '@nestjs/common';
import { InternalServerException } from '../../../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import * as crypto from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { RoleMutationService } from '../../../roles/role-mutation.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { UserCreationValidator } from '../../validators';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import * as schema from '../../../../../core/database/schema';

/**
 * UserCreationService
 * Handles user find/create logic — separated from OTP verification for SRP.
 *
 * ARCHITECTURE:
 * - OtpService: Pure OTP verification only (verify token with MSG91)
 * - UserCreationService: User find/create logic (no OTP knowledge)
 * - OtpAuthOrchestrator: Orchestrates full flow (verify OTP → find/create user → create session)
 *
 * This separation ensures:
 * - OtpService is pure verification logic (testable, reusable)
 * - UserCreationService can be reused by other flows (email signup, social auth)
 * - Each service has single responsibility
 */
@Injectable()
export class UserCreationService {
  private readonly logger = new Logger(UserCreationService.name);

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly roleQuery: RoleQueryService,
    private readonly roleMutation: RoleMutationService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  /**
   * Find or create user by phone number (after OTP verification confirms ownership).
   * Phone is guaranteed to be verified by MSG91 before calling this.
   *
   * IMPORTANT: OTP users can only be created AFTER a SUPER_ADMIN exists.
   * The first SUPER_ADMIN must be created via email/password registration.
   * OTP users always get the USER role.
   *
   * @param phone - Phone number (verified via OTP)
   * @returns User object with verified phone flag set
   */
  async findOrCreateByPhone(
    phone: string,
  ): Promise<typeof schema.users.$inferSelect> {
    let user = await this.authUsersRepository.findByPhone(phone);

    if (!user) {
      // Block OTP registration if no SUPER_ADMIN exists yet.
      // First admin must be created via email/password.
      await this.ensureSuperAdminExists();

      // Create user + USER role atomically.
      // OTP users always get USER role (never SUPER_ADMIN).
      user = await this.authUsersRepository.createUserWithInitialRole(
        {
          firstName: 'User',
          lastName: phone.slice(-4),
          phoneNumber: phone,
          phoneNumberVerified: true,
          iamUserId: crypto.randomUUID(),
        },
        null,
        (tx, userId) => this.assignUserRole(tx, userId),
      );

      UserCreationValidator.assertUserCreated(user);

      this.logger.log(`New user created via phone OTP: ${user.id}`);
    }

    // Mark phone as verified (after MSG91 confirmation)
    if (!user.phoneNumberVerified) {
      await this.authUsersRepository.verifyPhone(user.id);
      user = { ...user, phoneNumberVerified: true };
      this.logger.log(
        `Phone number verified for user ${user.id}: ${phone.slice(-4)}`,
      );
    }

    return user;
  }

  /**
   * Find or create user by email (for email signup after email OTP verification).
   *
   * @param email - Email (verified via OTP)
   * @param name - User's name (optional, from signup form)
   * @returns User object with verified email
   */
  async findOrCreateByEmail(
    email: string,
    name?: string,
  ): Promise<typeof schema.users.$inferSelect> {
    let user = await this.authUsersRepository.findByEmail(email);

    if (!user) {
      // Block email OTP registration if no SUPER_ADMIN exists yet.
      await this.ensureSuperAdminExists();

      // Create user + USER role atomically.
      user = await this.authUsersRepository.createUserWithInitialRole(
        {
          firstName: name ?? email.split('@')[0],
          lastName: '',
          email,
          emailVerified: true,
          iamUserId: crypto.randomUUID(),
        },
        null,
        (tx, userId) => this.assignUserRole(tx, userId),
      );

      UserCreationValidator.assertUserCreated(user);

      this.logger.log(`New user created via email OTP: ${user.id}`);
    }

    // Mark email as verified (after email OTP confirmation)
    if (!user.emailVerified) {
      await this.authUsersRepository.verifyEmail(user.id);
      user = { ...user, emailVerified: true };
      this.logger.log(`Email verified for user ${user.id}: ${email}`);
    }

    return user;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

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
   * Assign USER role within a transaction. OTP users never get SUPER_ADMIN.
   */
  private async assignUserRole(
    tx: NodePgDatabase<typeof schema>,
    userId: number,
  ): Promise<void> {
    const assigned = await this.roleMutation.assignRoleWithinTransaction(
      tx,
      userId,
      SystemRoleCodes.USER,
    );
    if (!assigned)
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
  }
}
