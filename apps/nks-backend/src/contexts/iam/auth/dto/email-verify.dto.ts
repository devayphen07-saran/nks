import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyEmailOtpSchema = z.object({
  email: z.email(),
  otp: z.string().min(6).max(6),
});

export class VerifyEmailOtpDto extends createZodDto(VerifyEmailOtpSchema) {}
