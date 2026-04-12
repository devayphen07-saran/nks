import { z } from "zod";
import { PHONE_LENGTH, numbersOnlyReg } from "@nks/utils";

export const phoneSchema = z.object({
  phone: z
    .string()
    .length(PHONE_LENGTH, "Phone number must be 10 digits")
    .refine((v) => numbersOnlyReg.test(v), "Phone must contain only digits"),
});

export type PhoneFields = z.infer<typeof phoneSchema>;
