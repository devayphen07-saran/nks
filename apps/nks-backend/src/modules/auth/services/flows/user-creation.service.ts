import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { SystemRoleCodes } from '../../../../common/constants/system-role-codes.constant';
import { ErrorCode } from '../../../../common/constants/error-codes.constants';
import * as schema from '../../../../core/database/schema';

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
    private readonly rolesRepository: RolesRepository,
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
  async findOrCreateByPhone(phone: string): Promise<typeof schema.users.$inferSelect> {
    let user = await this.authUsersRepository.findByPhone(phone);

    if (!user) {
      // Block OTP registration if no SUPER_ADMIN exists yet.
      // First admin must be created via email/password.
      await this.ensureSuperAdminExists();

      // Create user + USER role atomically.
      // OTP users always get USER role (never SUPER_ADMIN).
      user = await this.authUsersRepository.createUserWithInitialRole(
        {
          name: `User ${phone.slice(-4)}`,
          phoneNumber: phone,
          phoneNumberVerified: true,
          iamUserId: crypto.randomUUID(),
        },
        null,
        (tx, userId) => this.assignUserRole(tx, userId),
      );

      if (!user) {
        throw new BadRequestException('Failed to create user');
      }

      this.logger.log(`New user created via phone OTP: ${user.id}`);
    }

    // Mark phone as verified (after MSG91 confirmation)
    if (!user.phoneNumberVerified) {
      await this.authUsersRepository.verifyPhone(user.id);
      user = { ...user, phoneNumberVerified: true };
      this.logger.log(`Phone number verified for user ${user.id}: ${phone.slice(-4)}`);
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
          name: name || email.split('@')[0],
          email,
          emailVerified: true,
          iamUserId: crypto.randomUUID(),
        },
        null,
        (tx, userId) => this.assignUserRole(tx, userId),
      );

      if (!user) {
        throw new BadRequestException('Failed to create user');
      }

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
    const superAdminRoleId = await this.authUtils.getCachedSystemRoleId(SystemRoleCodes.SUPER_ADMIN);
    if (!superAdminRoleId) {
      throw new Error('SUPER_ADMIN system role not found in DB — run db:seed before accepting registrations');
    }
    const exists = await this.rolesRepository.hasSuperAdmin(superAdminRoleId);
    if (!exists) {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_NO_ADMIN_EXISTS,
        message: 'No admin account exists. Create the first admin using email and password before using OTP login.',
      });
    }
  }

  /**
   * Assign USER role within a transaction. OTP users never get SUPER_ADMIN.
   */
  private async assignUserRole(
    tx: NodePgDatabase<typeof schema>,
    userId: number,
  ): Promise<void> {
    await this.rolesRepository.assignRoleWithinTransaction(tx, userId, SystemRoleCodes.USER);
  }
}
