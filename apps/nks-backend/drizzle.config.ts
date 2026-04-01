import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

// ✅ Validate all database configuration at startup
const DatabaseConfigSchema = z.object({
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL must be a valid PostgreSQL connection string',
    ),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const config = DatabaseConfigSchema.parse(process.env);

export default defineConfig({
  schema: './src/core/database/schema.ts',
  out: './src/core/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
  // ✅ Enable strict mode in production to catch schema issues early
  strict: config.NODE_ENV === 'production',
  // ✅ Verbose logging in development only
  verbose: config.NODE_ENV === 'development',
});
