import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from './env.validation';

export default registerAs('app', () => {
  const env = getValidatedEnv();
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,                       // number — Zod coerces from string
    trustProxyHops: env.TRUST_PROXY_HOPS, // number — Zod coerces from string
    csrfHmacSecret: env.CSRF_HMAC_SECRET,
    csrfSameSite: env.CSRF_SAME_SITE as 'strict' | 'lax' | 'none',
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
  };
});
