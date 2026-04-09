import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { setupSwagger } from './config/swagger.config';
import { buildCorsConfig } from './config/cors.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import {
  TransformInterceptor,
  TimeoutInterceptor,
  LoggingInterceptor,
} from './common/interceptors';
import { validateEnv } from './config/env.validation';
import { CsrfMiddleware } from './common/middleware';

// ─── Env Validation ──────────────────────────────────────────────────────────
// Validate all required environment variables before anything else in the app.
// If any variable is missing or malformed the process exits immediately with a
// clear per-field error message — prevents cryptic runtime failures later.
validateEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(app.get(Logger));

  // ─── Config ───────────────────────────────────────────────────────────────
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4000;
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  // ─── Security: Helmet with CSP Headers ────────────────────────────────────
  // ✅ Content Security Policy (CSP) - prevents XSS attacks
  // ✅ X-Frame-Options - prevents clickjacking
  // ✅ X-Content-Type-Options - prevents MIME type sniffing
  // ✅ Strict-Transport-Security - enforces HTTPS
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Needed for styled-components
          imgSrc: ["'self'", 'https:', 'data:'],
          fontSrc: ["'self'", 'https:'],
          connectSrc: ["'self'", 'https:'],
          frameSrc: ["'none'"], // Prevent framing (clickjacking)
          formAction: ["'self'"], // Prevent form submission to external sites
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: nodeEnv === 'production',
        preload: nodeEnv === 'production',
      },
      frameguard: { action: 'deny' }, // Prevent clickjacking
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors(buildCorsConfig(configService));

  // ✅ CRITICAL: Cookie Parser Middleware (must be FIRST before other middleware)
  // This parses Cookie headers into request.cookies object
  // Without this, request.headers.cookie is unparseable
  app.use(cookieParser());

  // ─── CSRF Protection ──────────────────────────────────────────────────────
  // ✅ Prevents cross-site request forgery attacks
  const csrfMiddleware = new CsrfMiddleware();
  app.use(csrfMiddleware.use.bind(csrfMiddleware));

  // ─── Swagger ──────────────────────────────────────────────────────────────
  setupSwagger(app);

  // ─── Global Pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(new ZodValidationPipe());

  // ─── Global Filters ───────────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Interceptors ──────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // logs method, path, status, and duration
    new TransformInterceptor(), // wraps all raw returns in ApiResponse<T>
    new TimeoutInterceptor(), // enforces 25s limit
  );

  await app.listen(port);
  logger.log(`🚀 Backend running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs at:    http://localhost:${port}/api/v1/docs`);
}
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
