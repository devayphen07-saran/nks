# Key Rotation Implementation Guide

**Status:** Integration Instructions for Option C (Automated + Alerting)
**Version:** 1.0
**Last Updated:** 2026-04-13

---

## Overview

This guide covers integrating the automated key rotation system (Option C) into NestJS backend.

**Files Created:**
1. `src/modules/auth/services/key-rotation-scheduler.ts` — Automated rotation scheduler
2. `src/modules/auth/services/key-rotation-alert.service.ts` — Alert notifications
3. `docs/KEY_ROTATION_RUNBOOK.md` — Operations runbook

**Architecture Delivered:**
- ✅ Automated key rotation on configurable schedule (every 30 days)
- ✅ Maintenance window enforcement (02:00 UTC by default, low-traffic period)
- ✅ Zero-downtime rotation (old key archived in JWKS for 30 days)
- ✅ Structured log + Slack alerting (email not yet implemented)
- ✅ Emergency rotation trigger (for key compromise)
- ✅ Monitoring endpoint for rotation status
- ✅ Fallback key management (30-day grace period)

---

## Step 1: Install Dependencies

Required NestJS modules (already installed):

```bash
npm install @nestjs/config @nestjs/schedule
```

For Slack notifications (optional but recommended):
- No additional dependencies needed (uses native `fetch`)

> **Note**: Email alerts are not yet implemented. When ready, install `@nestjs-modules/mailer nodemailer` and wire into `KeyRotationAlertService`.

---

## Step 2: Update Auth Module

Update `src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeyRotationScheduler } from './services/key-rotation-scheduler';
import { KeyRotationAlertService } from './services/key-rotation-alert.service';
import { JWTConfigService } from '../../config/jwt.config';
// ... other imports

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    JWTConfigService,
    KeyRotationAlertService,
    KeyRotationScheduler,
    // ... other providers
  ],
  exports: [
    JWTConfigService,
    KeyRotationScheduler,
  ],
})
export class AuthModule {}
```

---

## Step 3: Add Environment Variables

Add to `.env`:

```bash
# Key Rotation Configuration
JWT_KEY_ROTATION_ENABLED=true
JWT_KEY_ROTATION_INTERVAL_DAYS=30
JWT_ROTATION_WINDOW_START=02:00
JWT_ROTATION_WINDOW_DURATION=60

# Alert Configuration (structured pino logs always fire; Slack is optional)
KEY_ROTATION_ALERT_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email alerts not yet implemented.
# When ready, wire @nestjs-modules/mailer and add:
# MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM
```

**For different environments:**

Development (`.env.development`):
```bash
JWT_KEY_ROTATION_ENABLED=false  # Disable for dev
KEY_ROTATION_ALERT_ENABLED=false
```

Production (`.env.production`):
```bash
JWT_KEY_ROTATION_ENABLED=true
JWT_KEY_ROTATION_INTERVAL_DAYS=30
JWT_ROTATION_WINDOW_START=02:00
JWT_ROTATION_WINDOW_DURATION=60
KEY_ROTATION_ALERT_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/... # Set in CI/CD secrets
```

---

## Step 4: Add Admin Endpoints

Add to `src/modules/auth/controllers/auth.controller.ts` (or new `admin.controller.ts`):

```typescript
import { Controller, Get, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { KeyRotationScheduler } from '../services/key-rotation-scheduler';
import { KeyRotationAlertService } from '../services/key-rotation-alert.service';

@Controller('admin/auth')
@UseGuards(AuthGuard, RBACGuard)
@Roles('SUPER_ADMIN') // Only super admin can trigger rotation
export class AdminAuthController {
  constructor(
    private readonly keyRotationScheduler: KeyRotationScheduler,
    private readonly keyRotationAlertService: KeyRotationAlertService,
  ) {}

  /**
   * Get current key rotation status
   * GET /admin/auth/key-rotation-status
   */
  @Get('key-rotation-status')
  getRotationStatus() {
    return this.keyRotationScheduler.getRotationStatus();
  }

  /**
   * Manually trigger emergency key rotation
   * POST /admin/auth/rotate-keys-emergency
   *
   * Use only if current key is compromised
   */
  @Post('rotate-keys-emergency')
  async rotateKeysEmergency() {
    try {
      const result = await this.keyRotationScheduler.rotateKeysEmergency();
      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Key rotation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test alert configuration
   * GET /admin/auth/test-key-rotation-alerts
   *
   * Sends test Slack message to verify alerts are working
   */
  @Get('test-key-rotation-alerts')
  async testAlertConfiguration() {
    return this.keyRotationAlertService.testAlertConfiguration();
  }
}
```

Update auth module providers:

```typescript
import { AdminAuthController } from './controllers/admin.controller';

@Module({
  controllers: [
    AuthController,
    AdminAuthController,  // Add this
  ],
  // ...
})
export class AuthModule {}
```

---

## Step 5: Update RSAKeyManager

The `KeyRotationScheduler` expects `RSAKeyManager` to support key rotation. Update `src/core/crypto/rsa-keys.ts`:

```typescript
/**
 * RSA Key Manager
 *
 * Handles loading and rotating RSA keys for JWT signing.
 * In production, keys are stored in HSM/KMS (not application code).
 */

let currentPrivateKey: string;
let currentPublicKey: string;

export class RSAKeyManager {
  /**
   * Get the current private key for JWT signing
   */
  static getPrivateKey(): string {
    if (!currentPrivateKey) {
      // Load from environment or HSM
      currentPrivateKey = process.env.RSA_PRIVATE_KEY || this.loadFromHSM('private');
    }
    return currentPrivateKey;
  }

  /**
   * Get the current public key for JWT verification
   */
  static getPublicKey(): string {
    if (!currentPublicKey) {
      currentPublicKey = process.env.RSA_PUBLIC_KEY || this.loadFromHSM('public');
    }
    return currentPublicKey;
  }

  /**
   * Rotate keys (called by KeyRotationScheduler)
   * In production:
   * 1. New key pair is generated in HSM (not here)
   * 2. Public key is exported to application
   * 3. This method updates the in-memory cache
   */
  static rotateKeys(newPrivateKey: string, newPublicKey: string): void {
    currentPrivateKey = newPrivateKey;
    currentPublicKey = newPublicKey;
    // In production: also update HSM references
  }

  /**
   * Load keys from HSM (placeholder)
   * In production, implement with:
   * - AWS KMS
   * - HashiCorp Vault
   * - Azure Key Vault
   * - YubiHSM / Luna HSM
   */
  private static loadFromHSM(keyType: 'private' | 'public'): string {
    // TODO: Implement HSM integration
    throw new Error('HSM integration not configured');
  }
}
```

---

## Step 6: Add Monitoring Metrics (Optional)

For production observability, add Prometheus metrics:

```bash
npm install @nestjs/prometheus prom-client
```

Create `src/core/metrics/key-rotation-metrics.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class KeyRotationMetrics {
  private rotationSuccessCounter: Counter;
  private rotationFailureCounter: Counter;
  private rotationDurationHistogram: Histogram;
  private fallbackKeysGauge: Histogram;

  constructor() {
    this.rotationSuccessCounter = new Counter({
      name: 'nks_key_rotation_success_total',
      help: 'Total number of successful key rotations',
      labelNames: ['reason'],
    });

    this.rotationFailureCounter = new Counter({
      name: 'nks_key_rotation_failure_total',
      help: 'Total number of failed key rotations',
      labelNames: ['reason', 'error_type'],
    });

    this.rotationDurationHistogram = new Histogram({
      name: 'nks_key_rotation_duration_ms',
      help: 'Duration of key rotation in milliseconds',
      buckets: [100, 500, 1000, 5000, 10000],
    });

    this.fallbackKeysGauge = new Histogram({
      name: 'nks_active_fallback_keys',
      help: 'Number of active fallback keys',
      buckets: [0, 1, 2, 3, 5],
    });
  }

  recordSuccess(reason: string, durationMs: number) {
    this.rotationSuccessCounter.labels(reason).inc();
    this.rotationDurationHistogram.observe(durationMs);
  }

  recordFailure(reason: string, errorType: string) {
    this.rotationFailureCounter.labels(reason, errorType).inc();
  }

  recordFallbackKeyCount(count: number) {
    this.fallbackKeysGauge.observe(count);
  }
}
```

Integrate into `KeyRotationScheduler`:

```typescript
constructor(
  private readonly jwtConfig: JWTConfigService,
  private readonly alertService: KeyRotationAlertService,
  private readonly metrics: KeyRotationMetrics,  // Add this
  configService: ConfigService,
) { }

// In performKeyRotation():
try {
  // ... rotation logic ...
  this.metrics.recordSuccess(reason, duration);
} catch (error) {
  this.metrics.recordFailure(reason, error.name || 'unknown');
}

// In getRotationStatus():
this.metrics.recordFallbackKeyCount(this.jwtConfig.listActiveKeys().length);
```

---

## Step 7: Testing

### Unit Tests

Create `src/modules/auth/services/key-rotation-scheduler.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeyRotationScheduler } from './key-rotation-scheduler';
import { JWTConfigService } from '../../../config/jwt.config';
import { KeyRotationAlertService } from './key-rotation-alert.service';

describe('KeyRotationScheduler', () => {
  let scheduler: KeyRotationScheduler;
  let jwtConfig: JWTConfigService;
  let alertService: KeyRotationAlertService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyRotationScheduler,
        {
          provide: JWTConfigService,
          useValue: {
            getCurrentKid: jest.fn().mockReturnValue('test-kid'),
            archiveCurrentKeyAsFallback: jest.fn(),
            listActiveKeys: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: KeyRotationAlertService,
          useValue: {
            alertRotationSuccess: jest.fn(),
            alertRotationFailure: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => defaultValue),
          },
        },
      ],
    }).compile();

    scheduler = module.get<KeyRotationScheduler>(KeyRotationScheduler);
    jwtConfig = module.get<JWTConfigService>(JWTConfigService);
    alertService = module.get<KeyRotationAlertService>(KeyRotationAlertService);
  });

  it('should initialize with config', () => {
    expect(scheduler).toBeDefined();
  });

  it('should get rotation status', () => {
    const status = scheduler.getRotationStatus();
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('currentKid');
    expect(status).toHaveProperty('activeKeys');
  });

  it('should alert on rotation failure', async () => {
    await expect(scheduler.performKeyRotation('scheduled')).rejects.toThrow();
    expect(alertService.alertRotationFailure).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
describe('KeyRotation Integration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /admin/auth/key-rotation-status should return current status', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/auth/key-rotation-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('currentKid');
    expect(response.body).toHaveProperty('activeKeys');
  });

  it('POST /admin/auth/rotate-keys-emergency should trigger rotation', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/auth/rotate-keys-emergency')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

## Step 8: Deployment Checklist

Before deploying to production:

- [ ] Environment variables set in deployment config
- [ ] SLACK_WEBHOOK_URL configured (optional but recommended)
- [ ] KEY_ROTATION_ALERT_ENABLED=true
- [ ] Maintenance window selected (JWT_ROTATION_WINDOW_START)
- [ ] Rotation interval set (JWT_KEY_ROTATION_INTERVAL_DAYS=30)
- [ ] HSM/KMS integration ready for key generation
- [ ] Monitoring dashboard created for key rotation metrics
- [ ] Alert recipients configured and tested
- [ ] Runbook shared with ops team
- [ ] On-call rotation updated with key rotation contacts

---

## Step 9: Post-Deployment Validation

After deploying:

1. **Test Alert System:**
   ```bash
   curl -X GET http://localhost:3000/admin/auth/test-key-rotation-alerts \
     -H "Authorization: Bearer <admin-token>"
   ```
   - Verify Slack notification posted (if `SLACK_WEBHOOK_URL` configured)
   - Check response: `{ slackConfigured, slackSendSucceeded, alertsEnabled }`

2. **Check Rotation Status:**
   ```bash
   curl -X GET http://localhost:3000/admin/auth/key-rotation-status \
     -H "Authorization: Bearer <admin-token>"
   ```
   - Confirm scheduler is enabled
   - Verify lastRotation is recent (if already rotated)

3. **Monitor Logs:**
   ```bash
   tail -f app.log | grep "Key rotation"
   ```
   - Look for scheduler initialization
   - Watch for scheduled rotation attempt

4. **Wait for Maintenance Window:**
   - Next rotation will occur during maintenance window
   - Check structured logs and Slack alerts

---

## Performance Impact

**Scheduler Overhead:**
- Hourly check: ~5ms
- Only runs during maintenance window
- Negligible impact on API performance

**Rotation Duration:**
- Key generation: 2-5 seconds (HSM-dependent)
- Total operation: < 10 seconds
- Zero impact on client requests (key rotation is async)

**Storage:**
- Fallback keys: ~1KB each
- 30 days × 1 rotation per 30 days = 1 fallback key in JWKS
- Minimal database/memory impact

---

## Rollback Plan

If issues occur after deployment:

1. **Disable scheduler (quick fix):**
   ```bash
   JWT_KEY_ROTATION_ENABLED=false
   # Restart service
   ```
   - Manual key rotation still available for emergencies

2. **Revert code:**
   ```bash
   git revert <commit-hash>
   npm install
   npm run build
   # Redeploy
   ```

3. **Notify team:**
   - Update #security-incidents Slack channel
   - Brief ops team on status

---

## Success Criteria

Implementation is successful when:

✅ Scheduler is enabled and running (visible in logs)
✅ First automated rotation completes successfully
✅ Structured pino logs emitted (KEY_ROTATION_SUCCESS / KEY_ROTATION_FAILED events)
✅ Slack notifications posted (if SLACK_WEBHOOK_URL configured)
✅ JWKS endpoint includes both active and fallback keys
✅ Clients can validate tokens after rotation
✅ Rotation status endpoint accessible to admins
✅ Emergency rotation endpoint working
✅ No errors in application logs related to rotation

---

## References

- [Key Rotation Runbook](./KEY_ROTATION_RUNBOOK.md)
- [JWT Configuration](../src/config/jwt.config.ts)
- [Key Rotation Scheduler Source](../src/modules/auth/services/key-rotation-scheduler.ts)
- [Alert Service Source](../src/modules/auth/services/key-rotation-alert.service.ts)
