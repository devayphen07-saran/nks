import { z } from 'zod';

/**
 * Shared password validation schema for creation flows (register, set-password, setup-super-admin).
 *
 * NKS Password Policy:
 * - Minimum 12 characters, maximum 100
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 *
 * NOTE: Do NOT use this schema for login. Login must accept any string so
 * users with passwords created under a prior (weaker) policy can still
 * authenticate. The bcrypt comparison is the real gate at login time.
 */
export const passwordCreationSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    'Password must contain at least one special character',
  );
