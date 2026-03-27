import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const phoneField = z
  .string()
  .min(10)
  .max(15)
  .regex(/^\+?\d+$/, 'Phone number must be valid international format')
  .transform((phone) => phone.replace(/^\+/, ''));

export const SendOtpSchema = z
  .object({ phone: phoneField.optional(), mobile: phoneField.optional() })
  .transform((data, ctx) => {
    const phone = data.phone ?? data.mobile;
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'phone or mobile is required' });
      return z.NEVER;
    }
    return { phone };
  });

export const VerifyOtpSchema = z
  .object({
    phone: phoneField.optional(),
    mobile: phoneField.optional(),
    otp: z.string().length(4, 'OTP must be 4 digits'),
    reqId: z.string().min(1, 'reqId is required'),
  })
  .transform((data, ctx) => {
    const phone = data.phone ?? data.mobile;
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'phone or mobile is required' });
      return z.NEVER;
    }
    return { phone, otp: data.otp, reqId: data.reqId };
  });

export class SendOtpDto extends createZodDto(SendOtpSchema) {}
export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
