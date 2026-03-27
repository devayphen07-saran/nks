import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

/**
 * Builds CORS options from config.
 *
 * Configure allowed origins via the `ALLOWED_ORIGINS` environment variable
 * (comma-separated, no trailing slashes):
 *   ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
 */
export function buildCorsConfig(configService: ConfigService): CorsOptions {
  const allowedOrigins =
    configService.get<string[]>('app.allowedOrigins') ?? [];

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // preflight cache: 24 h
  };
}
