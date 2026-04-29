import { Injectable } from '@nestjs/common';
import { InternalServerException } from '../../../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import { OnboardingValidator } from '../../validators';
import { OnboardingCompleteDto, OnboardingCompleteResponseDto } from '../../dto';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { AuthProviderRepository } from '../../repositories/auth-provider.repository';
import { TransactionService } from '../../../../../core/database/transaction.service';
import { OtpService } from '../otp/otp.service';
import { PasswordService } from '../security/password.service';

/**
 * OnboardingService
 *
 * Owns credential-completion flows for newly authenticated users:
 *   - Adding email + password after phone-OTP login
 *   - Adding phone number after email login
 *
 * Authorization Contract:
 *   - Called ONLY by authenticated users (userId must be their own session user ID)
 *   - No permission checks needed — user can only complete their own onboarding
 *   - Caller (auth controller) is responsible for validating userId matches session
 *
 * Business Rule Validation:
 *   - User must exist in the database
 *   - Email must not already be registered to another user
 *   - Phone number duplication check (allows re-registering same phone to same user)
 *   - Password is required when adding email credential
 *   - Profile marked complete only when no new credentials are added
 *
 * Audit Trail:
 *   - userId parameter identifies which user's credentials are being updated
 *   - Changes tracked via AuthUsersRepository and AuthProviderRepository
 *
 * Transactionality:
 *   - All credential updates wrapped in transaction for consistency
 *   - OTP sends happen AFTER transaction commits (non-blocking failures)
 *   - Failed OTP send does not roll back credential update
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly txService: TransactionService,
    private readonly otpService: OtpService,
    private readonly passwordService: PasswordService,
  ) {}

  async completeOnboarding(
    userId: number,
    dto: OnboardingCompleteDto,
  ): Promise<OnboardingCompleteResponseDto> {
    const user = await this.authUsersRepository.findById(userId);
    OnboardingValidator.assertUserFound(user);

    let emailVerificationSent = false;
    let phoneVerificationSent = false;
    let nextStep: 'verifyEmail' | 'verifyPhone' | 'complete' = 'complete';

    OnboardingValidator.assertPasswordRequired(dto.email, dto.password);

    // Hash password outside the transaction — bcrypt/argon2 is CPU-heavy and
    // holding an open connection for 100-300ms exhausts the pool under load.
    const passwordHash =
      dto.email && dto.password ? await this.passwordService.hash(dto.password) : null;

    await this.txService.run(async (tx) => {
      await this.authUsersRepository.update(userId, {
        ...(dto.firstName.trim() ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName.trim() ? { lastName: dto.lastName.trim() } : {}),
      }, userId, tx);

      if (dto.email) {
        if (!passwordHash) throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));

        const emailTaken = await this.authUsersRepository.emailExistsForOtherUser(
          dto.email,
          userId,
          tx,
        );
        OnboardingValidator.assertEmailNotTaken(emailTaken);

        await this.authUsersRepository.update(
          userId,
          { email: dto.email, emailVerified: false },
          userId,
          tx,
        );

        const existingProviderId =
          await this.authProviderRepository.findIdByUserIdAndProvider(userId, 'email', tx);

        if (existingProviderId) {
          await this.authProviderRepository.updatePassword(existingProviderId, passwordHash, tx);
        } else {
          await this.authProviderRepository.create(
            {
              accountId: dto.email,
              providerId: 'email',
              userId: userId,
              password: passwordHash,
              isVerified: false,
            },
            tx,
          );
        }

        nextStep = 'verifyEmail';
      }

      if (dto.phoneNumber) {
        const alreadyLinked = await this.authUsersRepository.phoneLinkedToUser(
          dto.phoneNumber,
          userId,
          tx,
        );
        if (!alreadyLinked) {
          await this.authUsersRepository.update(
            userId,
            { phoneNumber: dto.phoneNumber, phoneNumberVerified: false },
            userId,
            tx,
          );
        }
        nextStep = 'verifyPhone';
      }

      if (!dto.email && !dto.phoneNumber) {
        await this.authUsersRepository.markProfileComplete(userId, tx);
      }
    });

    // Send OTPs after the transaction commits
    if (dto.email) {
      await this.otpService.sendEmailOtp(dto.email);
      emailVerificationSent = true;
    }
    if (dto.phoneNumber) {
      await this.otpService.sendOtp({ phone: dto.phoneNumber });
      phoneVerificationSent = true;
    }

    return {
      emailVerificationSent,
      phoneVerificationSent,
      nextStep,
      message:
        nextStep === 'complete'
          ? 'Onboarding completed successfully'
          : `OTP sent. Please verify your ${nextStep === 'verifyEmail' ? 'email' : 'phone number'}`,
    };
  }
}
