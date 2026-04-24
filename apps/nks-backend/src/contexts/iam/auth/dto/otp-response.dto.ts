import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendOtpResponseSchema = z.object({
  reqId: z.string().describe('MSG91 request ID for later verification'),
  mobile: z.string().optional().describe('Phone number OTP was sent to'),
  data: z.any().optional(),
});

export const ResendOtpResponseSchema = z.object({
  reqId: z.string().describe('New MSG91 request ID'),
  mobile: z.string().describe('Phone number OTP was resent to'),
  data: z.any().optional(),
});

export class SendOtpResponseDto extends createZodDto(SendOtpResponseSchema) {}
export class ResendOtpResponseDto extends createZodDto(
  ResendOtpResponseSchema,
) {}
