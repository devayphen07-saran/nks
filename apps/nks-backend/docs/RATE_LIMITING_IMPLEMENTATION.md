# Rate Limiting Implementation Guide

**Option:** Quick Fix (Option A)
**Status:** Ready to Implement
**Date:** 2026-04-13

---

## Overview

This guide implements global API rate limiting to protect against:
- ✅ Credential stuffing (login brute-force)
- ✅ API scraping and abuse
- ✅ Resource exhaustion attacks
- ✅ Application-level DDoS

**Files Created:**
1. `src/config/rate-limiting.config.ts` — Configuration service
2. `src/common/guards/rate-limiting.guard.ts` — Enhanced rate limiting guard
3. Nginx configuration (separate file)

---

## Step 1: Install Dependencies

```bash
npm install @nestjs/throttler
```

**What it provides:**
- ThrottlerModule — NestJS module for rate limiting
- ThrottlerGuard — Guard to enforce rate limits
- @Throttle() — Decorator to customize limits per endpoint
- @SkipThrottle() — Decorator to skip limits (health checks, etc.)

---

## Step 2: Update App Module

Update `src/app.module.ts`:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';  // ADD THIS
import { RequestIdMiddleware } from './common/middleware';
import { ConfigModule } from './config/config.module';
// ... other imports
import { RateLimitingConfig } from './config/rate-limiting.config';  // ADD THIS

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,

    // ADD: ThrottlerModule with configuration
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigModule],
      useFactory: (configModule: ConfigModule) => {
        const rateLimitingConfig = new RateLimitingConfig(configModule.get(require('@nestjs/config').ConfigService));
        return rateLimitingConfig.getThrottlerOptions();
      },
    }),

    AuditModule,
    AuthModule,
    RolesModule,
    RoutesModule,
    LocationModule,
    LookupsModule,
    CodesModule,
    UsersModule,
    StatusModule,
    EntityStatusModule,
    SyncModule,
  ],
  controllers: [],
  providers: [RateLimitingConfig],  // ADD THIS
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

---

## Step 3: Apply Rate Limiting Guard Globally

Update `src/main.ts`:

```typescript
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
import { ThrottlerGuard } from '@nestjs/throttler';  // ADD THIS
import { APP_GUARD } from '@nestjs/core';  // ADD THIS
import {
  TransformInterceptor,
  TimeoutInterceptor,
  LoggingInterceptor,
} from './common/interceptors';
import { validateEnv } from './config/env.validation';
import { CsrfMiddleware } from './common/middleware';

validateEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4000;
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  // ─── Security: Helmet with CSP Headers
  app.use(helmet({
    // ... existing helmet config
  }));

  // ─── Global Prefix
  app.setGlobalPrefix('api/v1');

  // ─── CORS
  app.enableCors(buildCorsConfig(configService));

  // ─── Cookie Parser Middleware
  app.use(cookieParser());

  // ─── CSRF Protection
  const csrfMiddleware = new CsrfMiddleware();
  app.use(csrfMiddleware.use.bind(csrfMiddleware));

  // ─── Swagger
  setupSwagger(app);

  // ─── Global Pipes
  app.useGlobalPipes(new ZodValidationPipe());

  // ─── Global Filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new TimeoutInterceptor(),
  );

  // ─── Rate Limiting Guard (ADD THIS)
  // Apply ThrottlerGuard globally to all endpoints
  // Can be skipped with @SkipThrottle() decorator
  // Can be customized with @Throttle(limit, ttl) decorator
  app.useGlobalGuards(new ThrottlerGuard());

  await app.listen(port);
  logger.log(`🚀 Backend running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs at:    http://localhost:${port}/api/v1/docs`);
  logger.log(`🛡️  Rate limiting:      ENABLED (see THROTTLE_* env vars)`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

---

## Step 4: Configure Environment Variables

Add to `.env`:

```bash
# ─── Rate Limiting Configuration ────────────────────────────────────────────
# Global rate limiting (apply to all endpoints not @SkipThrottle)
THROTTLE_ENABLED=true              # Set false to disable in development
THROTTLE_TTL=900                   # Time window in seconds (15 minutes)
THROTTLE_LIMIT=100                 # Max requests per window (100 req/15min)

# For development (very lenient):
# THROTTLE_ENABLED=false

# For production (stricter):
# THROTTLE_TTL=300
# THROTTLE_LIMIT=50
```

**Configuration Examples:**

Development (lenient):
```bash
THROTTLE_ENABLED=false
```

Staging (moderate):
```bash
THROTTLE_ENABLED=true
THROTTLE_TTL=600        # 10 minutes
THROTTLE_LIMIT=100      # ~10 req/min average
```

Production (strict):
```bash
THROTTLE_ENABLED=true
THROTTLE_TTL=300        # 5 minutes
THROTTLE_LIMIT=50       # ~10 req/min average
```

---

## Step 5: Apply Custom Rate Limits to Endpoints

### Stricter Limits on Auth Endpoints

Update `src/modules/auth/controllers/auth.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards, Throttle, SkipThrottle } from '@nestjs/common';
import { RateLimitingConfig } from '../../../config/rate-limiting.config';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login endpoint
   * Strict rate limiting: 10 requests per 15 minutes
   * Prevents credential stuffing attacks
   */
  @Post('login')
  @Throttle(
    RateLimitingConfig.PRESETS.AUTH_STRICT.limit,
    RateLimitingConfig.PRESETS.AUTH_STRICT.ttl,
  )
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Token refresh endpoint
   * Moderate rate limiting: 50 requests per 15 minutes
   * Prevents token refresh attacks
   */
  @Post('refresh')
  @Throttle(
    RateLimitingConfig.PRESETS.PUBLIC.limit,
    RateLimitingConfig.PRESETS.PUBLIC.ttl,
  )
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  /**
   * Health check endpoint
   * Skip rate limiting (monitoring systems call this frequently)
   */
  @Get('health')
  @SkipThrottle()
  health() {
    return { status: 'ok' };
  }
}
```

### Stricter Limits on OTP Endpoints

Update `src/modules/auth/controllers/otp.controller.ts`:

```typescript
import { Controller, Post, Body, Throttle } from '@nestjs/common';
import { RateLimitingConfig } from '../../../config/rate-limiting.config';

@Controller('auth/otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  /**
   * Send OTP endpoint
   * Very strict: 5 requests per hour
   * Combined with OtpRateLimitService exponential backoff
   * Defense in depth: app-level + database-level rate limiting
   */
  @Post('send')
  @Throttle(
    RateLimitingConfig.PRESETS.OTP.limit,
    RateLimitingConfig.PRESETS.OTP.ttl,
  )
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto);
  }

  /**
   * Verify OTP endpoint
   * Moderate: 50 requests per 15 minutes (user tries multiple codes)
   */
  @Post('verify')
  @Throttle(
    RateLimitingConfig.PRESETS.PUBLIC.limit,
    RateLimitingConfig.PRESETS.PUBLIC.ttl,
  )
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}
```

---

## Step 6: Error Handling

Update `src/common/filters/global-exception.filter.ts` to handle ThrottlerException:

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';  // ADD THIS

@Catch(ThrottlerException)  // ADD THIS HANDLER
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    return response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests, please try again later',
      timestamp: new Date().toISOString(),
      path: request.url,
      // Optional: include retry-after header
      retryAfter: request.headers['retry-after'],
    });
  }
}
```

Then add to global filters in `main.ts`:

```typescript
app.useGlobalFilters(
  new GlobalExceptionFilter(),
  new ThrottlerExceptionFilter(),  // ADD THIS
);
```

---

## Step 7: Response Headers

Rate limiting adds HTTP headers to every response:

```
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1681234567
Retry-After: 234
```

**For clients:**
- `RateLimit-Remaining`: Requests left in current window
- `Retry-After`: Seconds to wait before retrying (on 429)

---

## Step 8: Testing

### Test Global Rate Limiting

```bash
# Send 101 requests in 15 minutes (exceeds limit of 100)
for i in {1..101}; do
  curl -s http://localhost:4000/api/v1/lookups/countries -w "Status: %{http_code}\n"
  sleep 1
done

# Expected:
# First 100: HTTP 200
# 101st+: HTTP 429 (Too Many Requests)
```

### Test Stricter Auth Limits

```bash
# Send 11 requests to login (exceeds limit of 10)
for i in {1..11}; do
  curl -s -X POST http://localhost:4000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"password"}' \
    -w "Status: %{http_code}\n"
  sleep 1
done

# Expected:
# First 10: HTTP 200/401/403 (depends on auth logic)
# 11th+: HTTP 429
```

### Check Remaining Requests

```bash
curl -i http://localhost:4000/api/v1/lookups/countries | grep RateLimit

# Output:
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# RateLimit-Reset: 1681234567
```

---

## Step 9: Monitoring & Logging

Add rate limiting metrics to your monitoring dashboard:

**Prometheus Metrics (optional):**
```
throttler_requests_total{endpoint="/auth/login",status="200|429"}
throttler_remaining{endpoint="/auth/login"}
throttler_reset{endpoint="/auth/login"}
```

**Log Examples:**
```
[RateLimitingGuard] Rate limit exceeded: 192.168.1.100 → POST /api/v1/auth/login
[ThrottlerGuard] Request limit for 192.168.1.100 exceeded
```

---

## Step 10: Documentation

Add to API documentation (Swagger):

```typescript
@Post('login')
@Throttle(10, 900)
@ApiOperation({ summary: 'Login endpoint' })
@ApiResponse({
  status: 200,
  description: 'Login successful',
  schema: { example: { accessToken: '...', refreshToken: '...' } },
})
@ApiResponse({
  status: 429,
  description: 'Too many requests — rate limit exceeded',
  headers: {
    'RateLimit-Limit': { schema: { example: 10 } },
    'RateLimit-Remaining': { schema: { example: 5 } },
    'Retry-After': { schema: { example: 234 } },
  },
})
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

---

## Configuration Summary

| Setting | Default | Strict (Prod) | Lenient (Dev) |
|---|---|---|---|
| THROTTLE_ENABLED | true | true | false |
| THROTTLE_TTL | 900s | 300s | - |
| THROTTLE_LIMIT | 100 | 50 | - |
| Rate | 6.7 req/sec | 10 req/min | Unlimited |
| Auth (login) | 10/15min | 5/5min | 100/15min |
| OTP (send) | 5/hour | 3/hour | 5/hour |

---

## Deployment Checklist

- [ ] Install @nestjs/throttler: `npm install @nestjs/throttler`
- [ ] Update app.module.ts with ThrottlerModule
- [ ] Update main.ts with ThrottlerGuard
- [ ] Create rate-limiting.config.ts
- [ ] Create rate-limiting.guard.ts
- [ ] Add THROTTLE_* env vars to .env
- [ ] Apply @Throttle() decorators to endpoints
- [ ] Update error handling for ThrottlerException
- [ ] Test rate limiting with curl
- [ ] Update Swagger documentation
- [ ] Deploy to staging environment
- [ ] Monitor rate limiting logs
- [ ] Deploy to production

---

## Next Steps After NestJS Implementation

This is **Step 1 of 3** for complete infrastructure rate limiting:

1. ✅ **NestJS ThrottlerModule** (this guide) — Application-level
2. 📋 **Nginx Rate Limiting** — Reverse proxy level
3. 📋 **WAF / DDoS Protection** — Infrastructure level (CloudFlare, AWS WAF)

Once this is deployed, proceed to:
- Deploy Nginx with rate limiting rules
- Add ModSecurity WAF rules
- Configure DDoS protection (CloudFlare or AWS Shield)

---

## References

- [NestJS Throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [HTTP Rate Limiting Best Practices](https://tools.ietf.org/html/draft-polli-ratelimit-headers)
- [OWASP API Security — API4: Unrestricted Resource Consumption](https://owasp.org/API-Security/API4-2019-Unrestricted-Resource-Consumption/)
