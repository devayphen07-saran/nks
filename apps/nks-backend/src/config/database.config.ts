import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from './env.validation';

export default registerAs('database', () => {
  const env = getValidatedEnv();
  return {
    url: env.DATABASE_URL,
    // Optional read-replica. When absent, readonly queries fall back to the
    // primary pool — local dev and single-node deployments need no change.
    readonlyUrl: env.DATABASE_READONLY_URL ?? null,
  };
});
