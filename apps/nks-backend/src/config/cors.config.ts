import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

/**
 * Builds CORS options from config.
 *
 * Configure allowed origins via the `ALLOWED_ORIGINS` environment variable
 * (comma-separated, no trailing slashes):
 *   ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
 *
 * Requests with no Origin header (React Native / Expo) are intentionally
 * allowed — CORS is a browser-only mechanism and provides no protection
 * against non-browser clients regardless. Real security for headerless
 * clients is enforced by the auth layer (JWT / session tokens).
 *
 * If stricter non-browser control is needed, add an API key middleware
 * that runs before auth.
 */
export function buildCorsConfig(configService: ConfigService): CorsOptions {
  const allowedOrigins = configService.get<string[]>('app.allowedOrigins') ?? [];

  return {
    origin: (origin, callback) => {
      // No Origin header — non-browser client (mobile app, server). Allow and
      // rely on the auth layer for security rather than CORS.
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      callback(new Error('Not allowed by CORS'));
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
