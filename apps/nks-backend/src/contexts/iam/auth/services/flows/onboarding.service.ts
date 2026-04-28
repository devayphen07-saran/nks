import { Injectable, Logger } from '@nestjs/common';
import { InternalServerException } from '../../../../../common/exceptions';
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
 * OTP sending is intentionally done outside the transaction so that DB changes
 * are committed before the external API call, and a failed OTP send does not
 * roll back the credential update.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

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
      }, tx);

      if (dto.email) {
        if (!passwordHash) throw new InternalServerException('Password hash missing — assertPasswordRequired should have caught this');

        const emailTaken = await this.authUsersRepository.emailExistsForOtherUser(
          dto.email,
          userId,
          tx,
        );
        OnboardingValidator.assertEmailNotTaken(emailTaken);

        await this.authUsersRepository.update(
          userId,
          { email: dto.email, emailVerified: false },
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
