import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Unified endpoint for all profile updates after login:
 * - Update name (always allowed)
 * - Add/update email + password (if logged in via phone)
 * - Add/update phone number (if logged in via email)
 * - Update password (at any time, requires email to be set)
 *
 * Password is required when adding email, optional otherwise.
 */
export const OnboardingCompleteSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(8).optional(),
});

export class OnboardingCompleteDto extends createZodDto(OnboardingCompleteSchema) {}

export class OnboardingCompleteResponseDto {
  // True if email was provided and needs verification OTP
  emailVerificationSent!: boolean;
  // True if phone was provided and needs verification OTP
  phoneVerificationSent!: boolean;
  // What the user should do next
  nextStep!: 'verifyEmail' | 'verifyPhone' | 'complete';
  // Message for user
  message!: string;
}
