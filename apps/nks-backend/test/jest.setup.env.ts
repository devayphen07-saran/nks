/**
 * Test-only env stubs.
 *
 * Several modules call `getValidatedEnv()` at import time (e.g.
 * common/constants/app-constants.ts -> common/utils/auth-helpers.ts), so the
 * env validator runs as soon as a spec imports anything from those graphs.
 *
 * These dummy values are obvious-non-secrets — they exist purely to satisfy
 * the zod schema during unit tests. Production secrets must come from the
 * real environment / secrets manager.
 */
const dummy64 = 'test-dummy-secret-do-not-use-in-production-0123456789abcdef';

const stubs: Record<string, string> = {
  // Runtime
  NODE_ENV: 'development',
  // Database
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  // Better Auth
  BETTER_AUTH_SECRET: dummy64,
  BETTER_AUTH_BASE_URL: 'http://localhost:4000',
  // MSG91
  MSG91_AUTH_KEY: 'test-msg91-key',
  MSG91_WIDGET_ID: 'test-widget',
  // HMAC secrets
  OTP_HMAC_SECRET: dummy64,
  IP_HMAC_SECRET: dummy64,
  OTP_IDENTIFIER_PEPPER: dummy64,
  OFFLINE_SESSION_HMAC_SECRET: dummy64,
  // Security
  COOKIE_SIGNING_SECRET: dummy64,
};

// Force NODE_ENV to a value the env schema accepts (Jest defaults it to 'test').
process.env.NODE_ENV = 'development';

for (const [key, value] of Object.entries(stubs)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
