import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL!,
  // Optional read-replica URL. When absent, readonly queries fall back to the
  // primary pool — local dev and single-node deployments need no change.
  readonlyUrl: process.env.DATABASE_READONLY_URL ?? null,
}));
