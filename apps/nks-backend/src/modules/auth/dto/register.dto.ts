import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordCreationSchema } from './password-validation.dto';

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: passwordCreationSchema,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
