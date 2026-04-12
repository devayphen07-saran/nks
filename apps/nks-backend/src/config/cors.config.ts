import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

/**
 * Builds CORS options from config.
 *
 * Configure allowed origins via the `ALLOWED_ORIGINS` environment variable
 * (comma-separated, no trailing slashes):
 *   ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
 *
 * Mobile apps (React Native / Expo) send no Origin header.
 * Undefined origin is allowed so mobile requests are not blocked.
 */
export function buildCorsConfig(configService: ConfigService): CorsOptions {
  const allowedOrigins =
    configService.get<string[]>('app.allowedOrigins') ?? [];

  return {
    origin: (origin, callback) => {
      // Mobile apps send no Origin header — allow undefined
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cookie',
      'X-Client-Type',
      'X-Client-Version',
      'X-Device-Fingerprint',
      'X-Idempotency-Key',
      'X-CSRF-Token',
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'X-Request-Id',
    ],
    maxAge: 86400,
  };
}
