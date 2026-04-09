import { z } from "zod";

export const phoneSchema = z.object({
  phone: z
    .string()
    .length(10, "Phone number must be 10 digits")
    .refine((v) => /^\d+$/.test(v), "Phone must contain only digits"),
});

export type PhoneFields = z.infer<typeof phoneSchema>;
