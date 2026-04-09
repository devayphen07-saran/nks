import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Login DTO - Validates password matches registration requirements
 * Requires: min 12 chars, uppercase, lowercase, number, special char
 */
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Password must contain at least one special character'),
});

export class LoginDto extends createZodDto(LoginSchema) {}
