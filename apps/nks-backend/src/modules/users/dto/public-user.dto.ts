import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PublicUserSchema = z.object({
  id: z.number().describe('Internal numeric database ID'),
  name: z.string().nullable().describe('Display name'),
  email: z.string().nullable().describe('User email address'),
  emailVerified: z.boolean().describe('Whether the email has been verified'),
  phoneNumber: z.string().nullable().describe('Verified phone number'),
  phoneNumberVerified: z
    .boolean()
    .describe('Whether the phone number has been verified'),
  image: z.string().nullable().describe('Profile image URL'),
  lastLoginAt: z.string().nullable().describe('Last login timestamp'),
  lastLoginIp: z.string().nullable().describe('Last login IP address'),
});

export class PublicUserDto extends createZodDto(PublicUserSchema) {}
