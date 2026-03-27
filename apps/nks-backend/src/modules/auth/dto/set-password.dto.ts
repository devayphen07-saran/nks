import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class SetPasswordDto extends createZodDto(SetPasswordSchema) {}
