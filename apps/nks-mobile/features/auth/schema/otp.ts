import { z } from "zod";

export const otpSchema = z.object({
  otp: z
    .string()
    .length(4, "OTP must be exactly 4 digits")
    .refine((v) => /^\d+$/.test(v), "OTP must contain only digits"),
});

export type OtpFields = z.infer<typeof otpSchema>;
