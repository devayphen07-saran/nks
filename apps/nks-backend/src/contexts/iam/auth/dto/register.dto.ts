import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { passwordCreationSchema } from './password-validation.dto';

export const RegisterSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Invalid email address'),
  password: passwordCreationSchema,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
