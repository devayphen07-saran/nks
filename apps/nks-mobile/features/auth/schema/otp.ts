import { z } from "zod";
import { OTP_LENGTH, numbersOnlyReg } from "@nks/utils";

export const otpSchema = z.object({
  otp: z
    .string()
    .length(OTP_LENGTH, "OTP must be exactly 6 digits")
    .refine((v) => numbersOnlyReg.test(v), "OTP must contain only digits"),
});

export type OtpFields = z.infer<typeof otpSchema>;
