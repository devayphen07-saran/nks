import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
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

  constructor(private readonly authUsersRepository: AuthUsersRepository) {}

  /**
   * Find or create user by phone number (after OTP verification confirms ownership).
   * Phone is guaranteed to be verified by MSG91 before calling this.
   *
   * @param phone - Phone number (verified via OTP)
   * @returns User object with verified phone flag set
   */
  async findOrCreateByPhone(phone: string): Promise<
    typeof schema.users.$inferSelect
  > {
    // Find existing user
    let user = await this.authUsersRepository.findByPhone(phone);

    if (!user) {
      // Create new user with phone number (first time login)
      user = await this.authUsersRepository.create({
        name: `User ${phone.slice(-4)}`,
        phoneNumber: phone,
        phoneNumberVerified: false,
        iamUserId: crypto.randomUUID(),
      });

      if (!user) {
        throw new BadRequestException('Failed to create user');
      }

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
    // Find existing user
    let user = await this.authUsersRepository.findByEmail(email);

    if (!user) {
      // Create new user
      user = await this.authUsersRepository.create({
        name: name || email.split('@')[0],
        email,
        emailVerified: false,
        iamUserId: crypto.randomUUID(),
      });

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
}
