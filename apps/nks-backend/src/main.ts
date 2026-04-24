import { NestFactory } from '@nestjs/core';
import { Logger as StaticLogger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './config/swagger.config';
import { buildCorsConfig } from './config/cors.config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { CsrfMiddleware, PermissionsPolicyMiddleware } from './common/middleware';

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
  // ✅ Permissions-Policy - restricts browser APIs not needed by a POS app
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
      permittedCrossDomainPolicies: false,
    }),
  );

  // Permissions-Policy — deny browser APIs not needed by a POS application.
  // Helmet does not set this header natively; applied separately.
  const permissionsPolicy = new PermissionsPolicyMiddleware();
  app.use(permissionsPolicy.use.bind(permissionsPolicy));

  // ─── Trust Proxy ──────────────────────────────────────────────────────────
  // Required behind reverse proxies (nginx, AWS ALB) for accurate IP extraction
  // via req.ip. Without this, req.ip is the proxy's IP, breaking rate limiting
  // and audit logs. Configurable per environment (e.g., Cloudflare → ALB → App = 2).
  const trustProxyHops = configService.get<number>('app.trustProxyHops') ?? 1;
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors(buildCorsConfig(configService));

  // ✅ CRITICAL: Cookie Parser Middleware (must be FIRST before other middleware)
  // This parses Cookie headers into request.cookies object.
  // Signing secret enables signed cookies (res.cookie('name', 'val', { signed: true }))
  // and mitigates cookie tampering.
  const cookieSecret = configService.getOrThrow<string>('COOKIE_SIGNING_SECRET');
  app.use(cookieParser(cookieSecret));

  // ─── CSRF Protection ──────────────────────────────────────────────────────
  // ✅ Prevents cross-site request forgery attacks
  const csrfMiddleware = new CsrfMiddleware(configService);
  app.use(csrfMiddleware.use.bind(csrfMiddleware));

  // ─── Swagger ──────────────────────────────────────────────────────────────
  // Never expose the API schema in production — it leaks endpoint details,
  // parameter names, and response shapes that aid enumeration attacks.
  if (nodeEnv !== 'production') {
    setupSwagger(app);
    logger.log(`📚 Swagger docs at:    http://localhost:${port}/api/v1/docs`);
  }

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 Backend running on: http://localhost:${port}/api/v1`);
}
bootstrap().catch((error: unknown) => {
  new StaticLogger('bootstrap').error('Failed to start application', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
