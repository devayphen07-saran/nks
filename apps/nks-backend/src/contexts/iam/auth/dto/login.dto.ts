import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Login DTO — password is intentionally unconstrained here (no complexity rules).
 * bcrypt comparison is the real gate. Enforcing complexity at login would lock out
 * users whose passwords were created under a prior weaker policy (M7).
 */
export const LoginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(100),
});

export class LoginDto extends createZodDto(LoginSchema) {}
