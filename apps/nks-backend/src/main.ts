import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { setupSwagger } from './config/swagger.config';
import { buildCorsConfig } from './config/cors.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import {
  TransformInterceptor,
  TimeoutInterceptor,
  LoggingInterceptor,
} from './common/interceptors';
import { validateEnv } from './config/env.validation';

// ─── Env Validation ──────────────────────────────────────────────────────────
// Validate all required environment variables before anything else in the app.
// If any variable is missing or malformed the process exits immediately with a
// clear per-field error message — prevents cryptic runtime failures later.
validateEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(app.get(Logger));

  // ─── Security ─────────────────────────────────────────────────────────────
  app.use(helmet());

  // ─── Config ───────────────────────────────────────────────────────────────
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4000;

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors(buildCorsConfig(configService));

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
bootstrap();
