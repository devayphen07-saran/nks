import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendEmailOtpSchema = z.object({
  email: z.string().email(),
});

export class SendEmailOtpDto extends createZodDto(SendEmailOtpSchema) {}

export const VerifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
});

export class VerifyEmailOtpDto extends createZodDto(VerifyEmailOtpSchema) {}

export class EmailVerifyResponseDto {
  verified: boolean;
  nextStep: 'setPassword' | 'complete';
}
