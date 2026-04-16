import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StoreSelectSchema = z.object({
  storeId: z.number().int().positive(),
});

export class StoreSelectDto extends createZodDto(StoreSelectSchema) {}

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
  name: z.string().min(2), // Required - update user name
  email: z.string().email().optional(), // Optional - add/update email
  phoneNumber: z.string().optional(), // Optional - add/update phone
  password: z.string().min(8).optional(), // Optional - required if adding email
});

export class OnboardingCompleteDto extends createZodDto(OnboardingCompleteSchema) {}

export class OnboardingCompleteResponseDto {
  // True if email was provided and needs verification OTP
  emailVerificationSent: boolean;
  // True if phone was provided and needs verification OTP
  phoneVerificationSent: boolean;
  // What the user should do next
  nextStep: 'verifyEmail' | 'verifyPhone' | 'complete';
  // Message for user
  message: string;
}
