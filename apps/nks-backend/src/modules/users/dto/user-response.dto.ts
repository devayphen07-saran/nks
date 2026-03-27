import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UserResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  kycLevel: z.string(),
  languagePreference: z.string(),
  whatsappOptedIn: z.boolean(),
  loginCount: z.number(),
  isBlocked: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
