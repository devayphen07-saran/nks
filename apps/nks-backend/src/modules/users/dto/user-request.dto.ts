import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional().or(z.string().length(0)),
  phoneNumber: z.string().optional(),
  languagePreference: z.enum(['en', 'ta']).optional(),
  whatsappOptedIn: z.boolean().optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
