import { z } from 'zod';

/**
 * Zod schema for all environment variables.
 * Validated at startup — the process exits with a clear error if anything is wrong.
 *
 * Rule: NEVER read process.env directly in app code.
 *       Use NestJS ConfigService instead (which reads from validated env).
 */
const envSchema = z.object({
  // ── Runtime ───────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  // ── Better Auth ───────────────────────────────────────────────────────────
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_BASE_URL: z
    .string()
    .url('BETTER_AUTH_BASE_URL must be a valid URL'),

  // ── MSG91 OTP ─────────────────────────────────────────────────────────────
  MSG91_AUTH_KEY: z.string().min(1, 'MSG91_AUTH_KEY is required'),
  MSG91_WIDGET_ID: z.string().min(1, 'MSG91_WIDGET_ID is required'),

  // ── HMAC Secrets ─────────────────────────────────────────────────────────
  OTP_HMAC_SECRET: z
    .string()
    .min(32, 'OTP_HMAC_SECRET must be at least 32 characters'),
  IP_HMAC_SECRET: z
    .string()
    .min(32, 'IP_HMAC_SECRET must be at least 32 characters'),
  OTP_IDENTIFIER_PEPPER: z
    .string()
    .min(16, 'OTP_IDENTIFIER_PEPPER must be at least 16 characters'),
  OFFLINE_SESSION_HMAC_SECRET: z
    .string()
    .min(32, 'OFFLINE_SESSION_HMAC_SECRET must be at least 32 characters'),

  // ── Security ──────────────────────────────────────────────────────────────
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  COOKIE_SIGNING_SECRET: z
    .string()
    .min(32, 'COOKIE_SIGNING_SECRET must be at least 32 characters'),

  // ── CORS ──────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().optional(),

  // ── AWS S3 (optional — only required when file upload is in use) ──────────
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // ── Google OAuth (optional — only when socialProviders is active) ─────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Call this at the very top of `main.ts` BEFORE NestFactory.create().
 * If validation fails, prints all field errors and exits(1).
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('');
    console.error('❌  Invalid or missing environment variables:');
    console.error('');

    const fieldErrors = result.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      console.error(`  ${field}: ${(messages ?? []).join(', ')}`);
    }

    console.error('');
    console.error('Fix the above issues in your .env or .env.local file.');
    console.error('');
    process.exit(1);
  }

  return result.data;
}
