# NKS Offline-First — Complete Flow Documentation

**Stack:** React Native + Expo SDK 53 · NestJS · Better Auth · Drizzle · PostgreSQL · PowerSync · expo-secure-store · jose

**Optimized for:** NKS delivery/field service — 15-min access JWT · 3-day offline JWT · 7-day session · OTP auth

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [What is stored on device](#2-what-is-stored-on-device)
3. [Shared utilities](#3-shared-utilities)
4. [Backend: Better Auth configuration](#4-backend-better-auth-configuration)
5. [Backend: AuthService — corrected](#5-backend-authservice--corrected)
6. [Mobile: auth client](#6-mobile-auth-client)
7. [Login flow — OTP end-to-end](#7-login-flow--otp-end-to-end)
8. [Login response — full breakdown](#8-login-response--full-breakdown)
9. [App startup — session hydration](#9-app-startup--session-hydration)
10. [Mobile: JWTManager — aligned with dual-token design](#10-mobile-jwtmanager--aligned-with-dual-token-design)
11. [Online operation — token refresh](#11-online-operation--token-refresh)
12. [Going offline — 3-day working window](#12-going-offline--3-day-working-window)
13. [Offline data — reads and writes](#13-offline-data--reads-and-writes)
14. [Offline countdown and UI tiers](#14-offline-countdown-and-ui-tiers)
15. [Reconnection after long offline](#15-reconnection-after-long-offline)
16. [Data sync — PowerSync](#16-data-sync--powersync)
17. [Database schema for sync](#17-database-schema-for-sync)
18. [Security hardening](#18-security-hardening)
19. [Error handling reference](#19-error-handling-reference)
20. [Configuration reference](#20-configuration-reference)
21. [Change summary](#21-change-summary)

---

## 1. Architecture overview

The NKS system has one **NestJS** backend serving two clients. The web dashboard (Next.js) is online-only and uses HttpOnly session cookies. The mobile app (Expo) is offline-first and uses two JWTs plus PowerSync for bidirectional sync.

```
┌──────────────────────────────────┐       ┌────────────────────────────────────┐
│  Web Dashboard (Next.js)         │       │  Mobile App (Expo)                 │
│  · HttpOnly cookie session       │       │  · auth.jwt.access  (15 min)       │
│  · Online only                   │       │  · auth.jwt.offline (3 days)       │
│  · Better Auth React hooks       │       │  · Opaque refresh token (7 days)   │
│  · Routes + Stores CRUD          │       │  · PowerSync local SQLite          │
└───────────────┬──────────────────┘       └──────────────┬─────────────────────┘
                │  HTTPS + cookie                         │  HTTPS + cookie
                │  (SameSite=Lax)                         │  SSL pinning
                └─────────────────┬───────────────────────┘
                          ┌───────▼────────────────┐
                          │   NestJS Backend       │
                          │   Better Auth          │
                          │   AuthService          │
                          │   Drizzle ORM          │
                          └───────┬────────────────┘
               ┌──────────────────┼──────────────────┐
               ▼                  ▼                  ▼
         PostgreSQL             Redis           PowerSync
         (source of truth)     (session        (WAL sync
                                cache)          engine)
               │                                     │
               └──── logical replication ────────────┘
```

### Dual-token design

Two separate JWTs serve different purposes. They have different TTLs and are stored under different SecureStore keys:

| Token | Key | TTL | Purpose |
|---|---|---|---|
| Access token | `auth.jwt.access` | 15 min | Bearer auth for online API calls |
| Offline token | `auth.jwt.offline` | 3 days | Offline identity verification without network |
| Opaque refresh | `auth.refresh.token` | 7 days | Exchange for new token pair on reconnect |
| Session cookie | `better-auth.session_token` | 7 days | Server-side session, stored by Expo plugin |

The offline token's `exp` claim **is** the offline window boundary — no client-side grace calculation is needed.

### Two JWT issuers — separate key sets

NKS has two independent JWT systems. They use different algorithms and different JWKS endpoints:

| Issuer | Algorithm | JWKS endpoint | Purpose |
|---|---|---|---|
| Better Auth JWT plugin | EdDSA (Ed25519) | `GET /api/auth/jwks` | Better Auth internal session-to-JWT exchange |
| NKS JWTConfigService | RS256 | `GET /api/v1/auth/nks-jwks` | Access token + offline token for mobile |

The mobile app uses **only** the NKS JWKS endpoint (`/api/v1/auth/nks-jwks`) because its tokens are signed with RS256 by `JWTConfigService`. Better Auth's EdDSA JWKS endpoint is used internally by Better Auth and is not relevant to the mobile app.

---

## 2. What is stored on device

```
expo-secure-store (iOS Keychain / Android Keystore — hardware-backed)
├── auth.jwt.access
│     RS256 JWT · TTL: 15 minutes
│     Claims: sub (guuid), sid, email, roles, iss, aud, jti
│     Purpose: Bearer auth for online API calls
│     Accessibility: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
│
├── auth.jwt.offline
│     RS256 JWT · TTL: 3 days (NKS offline window)
│     Claims: sub, email, roles, stores, activeStoreId, iss, aud
│     Purpose: offline identity verification via cached JWKS
│     Accessibility: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
│
├── auth.refresh.token
│     Opaque 32-byte token (hex-encoded) · TTL: 7 days rolling
│     Purpose: exchange for new token pair on reconnect
│     Accessibility: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
│
├── auth.jwks.cache
│     JSON: NKS RS256 public key set (from /api/v1/auth/nks-jwks)
│     TTL: no local expiry — refreshed on every reconnect
│     Purpose: verify BOTH NKS JWTs offline without network
│     NOTE: This is the NKS JWKS, NOT Better Auth's EdDSA JWKS
│
├── auth.offline.meta
│     JSON: { lastOnlineAt, offlineJwtExpMs }
│     Purpose: drive countdown banner — no grace window calculation needed
│
├── auth.user.profile
│     JSON: { guuid, email, name, role, storeId, permissionsVersion }
│     Purpose: display user info while offline
│
├── auth.device.fingerprint
│     SHA-256 of (platform + model + appVersion)
│     Purpose: server-side theft detection via X-Device-Fingerprint header
│
└── better-auth.session_token
      Opaque session token · TTL: 7 days
      Stored by @better-auth/expo plugin
      Purpose: authenticate all online API requests

react-native-mmkv (AES-256 encrypted, key stored in SecureStore)
├── app.rbac.permissions      — role/permission snapshot
├── app.feature-flags         — feature flags from last sync
└── app.audit.log             — local audit trail (30-day window)
```

**Never store:** plaintext passwords · unencrypted tokens in AsyncStorage · client secrets · private signing keys.

---

## 3. Shared utilities

### `fetchWithTimeout` (mobile)

The native `fetch` API silently ignores a `timeout` option. All network calls must use `AbortController`:

```typescript
// apps/mobile/src/lib/fetch-with-timeout.ts
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, ...rest } = options;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    clearTimeout(timerId);
    return res;
  } catch (err) {
    clearTimeout(timerId);
    if ((err as Error).name === 'AbortError') throw new Error('REQUEST_TIMEOUT');
    throw err;
  }
}
```

### `createLogger` (mobile)

React hooks cannot be called outside React components. Use a plain factory for class-level and service-level logging:

```typescript
// apps/mobile/src/lib/logger.ts
export function createLogger(context: string) {
  return {
    log:   (msg: string, data?: unknown) =>
      __DEV__ && console.log(`[${context}] ${msg}`, data ?? ''),
    warn:  (msg: string, data?: unknown) =>
      console.warn(`[${context}] ${msg}`, data ?? ''),
    error: (msg: string, data?: unknown) =>
      console.error(`[${context}] ${msg}`, data ?? ''),
  };
}
```

---

## 4. Backend: Better Auth configuration

Better Auth's JWT plugin is configured with EdDSA for its own internal use. NKS's custom JWTConfigService uses RS256 for the access and offline tokens that the mobile app consumes. These are two independent systems — Better Auth's JWKS endpoint is not used by the mobile app.

```typescript
// src/modules/auth/config/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, bearer, admin, expo } from 'better-auth/plugins';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@core/database/schema';

export const getAuth = (database: NodePgDatabase<typeof schema>) =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL!,
    secret:  process.env.BETTER_AUTH_SECRET!,

    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: {
        user:    schema.users,
        session: schema.userSession,
        account: schema.userAuthProvider,
        // Do NOT override the verification table.
        // Better Auth's default schema must be used as-is.
        // OTP tracking is handled by the separate otp_request_log table.
      },
    }),

    trustedOrigins: [
      'https://dashboard.nks.com',
      'http://localhost:3000',
      'nks://',
      'exp://192.168.*.*:*/**',
    ],

    session: {
      // FIX #9: was documented as 30 days — correct value is 7 days
      expiresIn:    60 * 60 * 24 * 7,  // 7 days
      updateAge:    60 * 60 * 24,       // extend daily on activity
      cookieCache: { enabled: true, maxAge: 5 * 60 },
      hashSessionToken: true,
    },

    plugins: [
      expo(),      // stores session cookie in expo-secure-store

      // Better Auth's own JWT plugin — EdDSA keys for internal use.
      // The mobile app does NOT use this JWKS endpoint.
      // Mobile uses NKS's RS256 JWKS at /api/v1/auth/nks-jwks instead.
      jwt({
        jwt: {
          issuer:         process.env.BETTER_AUTH_URL!,
          audience:       process.env.BETTER_AUTH_URL!,
          expirationTime: '15m',
          definePayload: ({ user, session }) => ({
            sub:       user.id,
            email:     user.email,
            role:      user.role ?? 'driver',
            storeId:   (session as any).activeStoreFk,
            sessionId: session.id,
          }),
        },
        jwks: {
          keyPairConfig:    { alg: 'EdDSA', crv: 'Ed25519' },
          rotationInterval: 60 * 60 * 24 * 90,
          gracePeriod:      60 * 60 * 24 * 30,
        },
      }),
      bearer(),
      admin({ defaultRole: 'driver' }),
    ],
  });

export type Auth = ReturnType<typeof getAuth>;
```

### NKS JWKS endpoint — RS256 public key for mobile offline verification

The mobile app fetches this endpoint (not Better Auth's `/api/auth/jwks`) because NKS tokens are signed with RS256 by `JWTConfigService`:

```typescript
// src/modules/auth/controllers/auth.controller.ts
@Get('nks-jwks')
@Public()
async getNksJwks() {
  const publicKeyJwk = this.jwtConfigService.getPublicKeyAsJwk();
  return {
    keys: [
      {
        ...publicKeyJwk,
        kid: this.jwtConfigService.getCurrentKid(),
        use: 'sig',
        alg: 'RS256',
      },
    ],
  };
}
```

```typescript
// src/config/jwt.config.ts — additions for JWKS exposure
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JWTConfigService {
  private readonly publicKey: crypto.KeyObject;
  private readonly privateKey: crypto.KeyObject;
  private readonly currentKid: string;

  constructor() {
    // ... existing key loading ...
    this.currentKid = `nks-key-${this.computeKidFromPublicKey()}`;
  }

  /** Export the RSA public key in JWK format for the /nks-jwks endpoint */
  getPublicKeyAsJwk(): crypto.JsonWebKey {
    return this.publicKey.export({ format: 'jwk' });
  }

  getCurrentKid(): string {
    return this.currentKid;
  }

  private computeKidFromPublicKey(): string {
    const thumbprint = crypto.createHash('sha256')
      .update(this.publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex')
      .slice(0, 8);
    return thumbprint;
  }

  /**
   * Sign an offline token with a configurable TTL.
   * The offline JWT's own exp claim IS the offline window boundary.
   * Mobile does NOT need a separate grace period calculation.
   */
  signOfflineToken(
    payload: {
      sub: string;
      email?: string;
      roles: string[];
      stores: Array<{ id: number; name: string }>;
      activeStoreId: number | null;
    },
    expiresIn: string = '3d',  // configurable TTL — default 3 days
  ): string {
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn,
      issuer:    'nks-auth',
      audience:  'nks-app',
      keyid:     this.currentKid,
    });
  }
}
```

---

## 5. Backend: AuthService — corrected

All ten issues identified in the code review are fixed in this implementation.

### Constants

```typescript
// src/modules/auth/auth.service.ts
import * as crypto from 'crypto';
import { Injectable, UnauthorizedException,
         BadRequestException, ConflictException,
         ForbiddenException, Logger } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@core/database/schema';

// FIX #8: single source of truth for audience claim
const JWT_AUDIENCE = 'nks-app';

// FIX #10: constant and comment now agree
const MAX_CONCURRENT_SESSIONS = 5;

const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const SYSTEM_ROLE_STORE_OWNER = 'STORE_OWNER';
const IP_HMAC_SECRET = process.env['IP_HMAC_SECRET'] || 'default-ip-hmac-secret';

// Offline JWT TTL — controls how long the mobile device can work offline
// NKS policy: 3 days. Change here to update all downstream behaviour.
const OFFLINE_JWT_TTL_DAYS = 3;
const OFFLINE_JWT_EXPIRATION = `${OFFLINE_JWT_TTL_DAYS}d`;
```

### `createSessionForUser`

```typescript
async createSessionForUser(
  userId: number,
  deviceInfo?: DeviceInfo,
): Promise<CreateSessionResult> {
  const ctx     = await this.getBetterAuthContext();
  const session = await ctx.internalAdapter.createSession(String(userId));
  if (!session) throw new UnauthorizedException('Failed to create session');

  const permissions = await this.getUserPermissions(userId);
  const user        = await this.authUsersRepository.findEmailAndGuuid(userId);
  const userRoles   = permissions.roles ?? [];

  // FIX #2: hashRoles sorts before hashing — prevents false-positive rolesChanged
  const roleHash = this.hashRoles(userRoles);

  type DeviceType = 'IOS' | 'ANDROID' | 'WEB';
  const VALID_DEVICE_TYPES: readonly DeviceType[] = ['IOS', 'ANDROID', 'WEB'];
  const rawDeviceType = deviceInfo?.deviceType?.toUpperCase() as DeviceType | undefined;
  const validatedDeviceType: DeviceType | null =
    rawDeviceType && VALID_DEVICE_TYPES.includes(rawDeviceType) ? rawDeviceType : null;

  const ipHash = deviceInfo?.ipAddress
    ? crypto.createHmac('sha256', IP_HMAC_SECRET)
               .update(deviceInfo.ipAddress).digest('hex')
    : null;

  const updatedSession = await this.sessionsRepository.updateByToken(session.token, {
    roleHash,
    ...(deviceInfo ? {
      deviceId:   deviceInfo.deviceId   ?? null,
      deviceName: deviceInfo.deviceName ?? null,
      deviceType: validatedDeviceType,
      appVersion: deviceInfo.appVersion ?? null,
      ipAddress:  deviceInfo.ipAddress  ?? null,
      userAgent:  deviceInfo.userAgent  ?? null,
      ipHash,
    } : {}),
  });

  const sessionGuuid = updatedSession?.guuid ?? '';

  let jwtToken: string | undefined;
  try {
    jwtToken = this.jwtConfigService.signToken({
      sub:   user?.guuid ?? '',
      sid:   sessionGuuid,
      jti:   crypto.randomUUID(),
      ...(user?.email ? { email: user.email } : {}),
      roles: userRoles.map((r) => r.roleCode),
      iss:   'nks-auth',
      aud:   JWT_AUDIENCE,    // FIX #8: use constant
    });
  } catch (err) {
    this.logger.error(`Failed to sign JWT: ${err}`);
  }

  // FIX #10: MAX_CONCURRENT_SESSIONS constant used — no hardcoded value in comment
  await this.enforceSessionLimit(userId);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    sessionGuuid,
    jwtToken,
    userRoles,
    userEmail: user?.email ?? '',
  };
}
```

### `hashRoles` (Fix #2)

```typescript
// FIX #2: sort entries before hashing — identical role sets always produce identical hashes
// regardless of the order rows are returned from the database
private hashRoles(roles: UserRoleEntry[]): string {
  const sorted = roles
    .map((r) => `${r.roleCode}:${r.storeId ?? 'null'}`)
    .sort();
  return crypto.createHash('sha256')
               .update(JSON.stringify(sorted))
               .digest('hex');
}
```

### `createTokenPair` (Fixes #7, #8)

```typescript
// FIX #7: JWT TTL aligned with NKS spec — 15 minutes (was hardcoded 1 hour)
// FIX #8: JWT_AUDIENCE constant used everywhere — no hardcoded strings
async createTokenPair(
  userGuuid:    string,
  sessionToken: string,
  userRoles:    SessionUserRole[],
  userEmail:    string,
  sessionGuuid: string,
): Promise<TokenPair> {
  const jwtToken = this.jwtConfigService.signToken({
    sub:   userGuuid,
    sid:   sessionGuuid,
    jti:   crypto.randomUUID(),
    ...(userEmail ? { email: userEmail } : {}),
    roles: userRoles.map((r) => r.roleCode),
    iss:   'nks-auth',
    aud:   JWT_AUDIENCE,   // FIX #8
  });

  const { token: refreshToken, tokenHash: refreshTokenHash } =
    this.refreshTokenService.generateRefreshToken();

  const now = new Date();

  // FIX #7: 15 minutes — aligns with NKS architecture specification
  const jwtExpiresAt           = new Date(now.getTime() + 15 * 60 * 1000);
  const refreshTokenExpiresAt  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await this.sessionsRepository.setRefreshTokenData(sessionToken, {
    refreshTokenHash,
    refreshTokenExpiresAt,
    accessTokenExpiresAt: jwtExpiresAt,
  });

  this.logger.log(`Token pair created for ${userGuuid}. Access token: 15 min. Refresh: 7 days.`);

  return { jwtToken, refreshToken, jwtExpiresAt, refreshTokenExpiresAt };
}
```

### `buildAuthResponse` (Fix #9)

```typescript
// FIX #9: comment corrected — session TTL is 7 days, not 30 days
async buildAuthResponse(
  user: UserShape,
  token: string,
  expiresAt: Date,
  tokenPair?: TokenPair,
): Promise<AuthResponseEnvelope> {
  const requestId = crypto.randomUUID();
  const traceId   = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const issuedAt  = new Date().toISOString();

  // FIX #9: 7 days — matches Better Auth session.expiresIn config
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const storeOwnerRoleId = await this.rolesRepository.findSystemRoleId(SYSTEM_ROLE_STORE_OWNER);
  const primaryStore = storeOwnerRoleId
    ? await this.rolesRepository.findPrimaryStoreForUser(user.id, storeOwnerRoleId)
    : null;

  const permissions = await this.getUserPermissions(user.id);

  // Offline token TTL driven by OFFLINE_JWT_EXPIRATION constant (3 days for NKS).
  // This JWT's own exp claim IS the offline window boundary.
  // Mobile does NOT need a separate grace period calculation.
  const offlineToken = this.jwtConfigService.signOfflineToken(
    {
      sub:           user.guuid ?? '',
      ...(user.email ? { email: user.email } : {}),
      roles:         permissions.roles.map((r) => r.roleCode),
      stores:        permissions.roles
                       .filter((r) => r.storeId && r.storeName)
                       .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
      activeStoreId: permissions.activeStoreId ?? null,
    },
    OFFLINE_JWT_EXPIRATION,  // '3d'
  );

  return AuthMapper.toAuthResponseEnvelope(
    { user, token, session: { token, expiresAt, sessionId } },
    permissions,
    requestId,
    traceId,
    tokenPair,
    primaryStore ? { guuid: primaryStore.guuid } : null,
    sessionId,
    issuedAt,
    expiresAt,          // FIX #9: actual 7-day session expiry
    refreshExpiresAt,
    offlineToken,
  );
}
```

### `profileComplete` (Fix #1)

```typescript
// FIX #1: transaction callback now accepts and threads `tx` through all
// repository calls. Previously the callback ignored `tx` entirely,
// meaning every query ran on the pool connection and rollback was impossible.
async profileComplete(userId: number, dto: ProfileCompleteDto): Promise<ProfileCompleteResponseDto> {
  const user = await this.authUsersRepository.findById(userId);
  if (!user) throw new UnauthorizedException('User not found');

  let nextStep: 'verifyEmail' | 'verifyPhone' | 'complete' = 'complete';

  // FIX #6: compute password hash BEFORE opening the transaction.
  // passwordService.hash() is bcrypt/argon2 (100-300ms). Running it inside
  // db.transaction() holds a connection open for the entire hash duration,
  // exhausting the pool under concurrent load.
  const passwordHash = dto.email && dto.password
    ? await this.passwordService.hash(dto.password)
    : null;

  if (dto.email && !dto.password) {
    throw new BadRequestException('Password is required when adding email');
  }

  // FIX #1: tx is accepted and passed to every repository method inside
  await this.db.transaction(async (tx) => {
    await this.authUsersRepository.update(userId, { name: dto.name }, tx);

    if (dto.email) {
      const emailTaken = await this.authUsersRepository.emailExistsForOtherUser(
        dto.email, userId, tx,   // FIX #1: pass tx
      );
      if (emailTaken) throw new ConflictException('Email already in use by another user');

      await this.authUsersRepository.update(userId, {
        email: dto.email,
        emailVerified: false,
      }, tx);   // FIX #1

      const existingProviderId = await this.authProviderRepository
        .findIdByUserIdAndProvider(userId, 'email', tx);  // FIX #1

      if (existingProviderId) {
        await this.authProviderRepository.updatePassword(existingProviderId, passwordHash!, tx);
      } else {
        await this.authProviderRepository.create({
          accountId:  dto.email,
          providerId: 'email',
          userId,
          password:   passwordHash!,  // FIX #6: computed before transaction
          isVerified: false,
        }, tx);  // FIX #1
      }

      nextStep = 'verifyEmail';
    }

    if (dto.phoneNumber) {
      const alreadyLinked = await this.authUsersRepository.phoneLinkedToUser(
        dto.phoneNumber, userId, tx,  // FIX #1
      );
      if (!alreadyLinked) {
        await this.authUsersRepository.update(userId, {
          phoneNumber: dto.phoneNumber,
          phoneNumberVerified: false,
        }, tx);  // FIX #1
      }
      nextStep = 'verifyPhone';
    }

    if (!dto.email && !dto.phoneNumber) {
      await this.authUsersRepository.markProfileComplete(userId, tx);  // FIX #1
    }
  });

  // OTPs are sent OUTSIDE the transaction — an SMS cannot be rolled back
  let emailVerificationSent = false;
  let phoneVerificationSent = false;

  if (dto.email) {
    await this.otpService.sendEmailOtp(dto.email);
    emailVerificationSent = true;
  }

  if (dto.phoneNumber) {
    await this.otpService.sendOtp({ phone: dto.phoneNumber });
    phoneVerificationSent = true;
  }

  return {
    emailVerificationSent,
    phoneVerificationSent,
    nextStep,
    message: nextStep === 'complete'
      ? 'Profile completed successfully'
      : `OTP sent. Please verify your ${nextStep === 'verifyEmail' ? 'email' : 'phone number'}`,
  };
}
```

**Repository pattern for `tx` threading:**

Every repository method that participates in transactions must accept an optional `tx` parameter:

```typescript
// src/modules/auth/repositories/auth-users.repository.ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@core/database/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuthUsersRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async update(
    id: number,
    data: Partial<schema.UserInsert>,
    tx?: Db,   // optional — use transaction connection if provided
  ): Promise<schema.User | null> {
    const conn = tx ?? this.db;  // fall back to pool if no transaction
    const [updated] = await conn
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning();
    return updated ?? null;
  }

  // All other mutating methods follow the same pattern
}
```

### `rotateSession` (Fix #3)

```typescript
// FIX #3: oldToken is now validated before any session modification.
// Previously the method accepted oldToken but never verified it,
// allowing any caller who knows a userId to wipe all of that user's sessions.
async rotateSession(
  oldToken: string,
  userId:   number,
): Promise<CreateSessionResult> {
  // Verify the old token belongs to this user before touching anything
  const session = await this.sessionsRepository.findByToken(oldToken);
  if (!session || session.userId !== userId) {
    throw new UnauthorizedException('Invalid session token');
  }

  // Revoke only the specific session being rotated — not all sessions
  await this.sessionsRepository.delete(session.id);

  // Issue a fresh session for the same user
  return this.createSessionForUser(userId);
}
```

### `refreshAccessToken` (Fixes #4, #8)

The two session updates (new + revoked) must be atomic. If revoking the old token fails, the old refresh token remains valid and theft detection is bypassed:

```typescript
// Inside refreshAccessToken — replace the parallel Promise.all block with a transaction

// FIX #4: wrap both session updates in a single transaction
// FIX #8: use JWT_AUDIENCE constant for aud claim
await this.db.transaction(async (tx) => {
  await this.sessionsRepository.update(newSession.id, {
    roleHash:                currentRoleHash,
    deviceId:                session.deviceId,
    deviceName:              session.deviceName,
    deviceType:              session.deviceType,
    appVersion:              session.appVersion,
    activeStoreFk:           session.activeStoreFk,
    refreshTokenHash:        newRefreshTokenHash,
    refreshTokenExpiresAt:   newRefreshTokenExpiresAt,
    accessTokenExpiresAt,
  }, tx);  // FIX #4: pass tx

  await this.sessionsRepository.update(session.id, {
    refreshTokenRevokedAt: new Date(),
    revokedReason:         'ROTATION',
  }, tx);  // FIX #4: same transaction
});

// Sign new access token using constant for aud
const accessToken = this.jwtConfigService.signToken({
  sub:   user?.guuid ?? '',
  sid:   newSession.guuid,
  jti:   crypto.randomUUID(),
  ...(user?.email ? { email: user.email } : {}),
  roles: userRoles.map((r) => r.roleCode),
  iss:   'nks-auth',
  aud:   JWT_AUDIENCE,  // FIX #8
});

// Generate fresh 3-day offline JWT with current roles
const offlineToken = this.jwtConfigService.signOfflineToken(
  {
    sub:           user?.guuid ?? '',
    ...(user?.email ? { email: user.email } : {}),
    roles:         userRoles.map((r) => r.roleCode),
    stores:        userRoles
                     .filter((r) => r.storeId && r.storeName)
                     .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
    activeStoreId: userRoles.find((r) => r.storeId)?.storeId ?? null,
  },
  OFFLINE_JWT_EXPIRATION,  // '3d'
);
```

### `enforceSessionLimit` (Fix #5)

```typescript
// FIX #5: single atomic SQL DELETE eliminates the read-then-delete race condition.
// Previously: read all sessions → count → loop-delete excess.
// Race: two concurrent logins both read count=5, neither deletes, user ends up with 7 sessions.
private async enforceSessionLimit(userId: number): Promise<void> {
  // FIX #10: MAX_CONCURRENT_SESSIONS = 5 (constant and comment now agree)
  await this.sessionsRepository.deleteExcessSessions(userId, MAX_CONCURRENT_SESSIONS);
}
```

Repository method using a single atomic DELETE:

```typescript
// src/modules/auth/repositories/sessions.repository.ts
async deleteExcessSessions(userId: number, maxAllowed: number): Promise<void> {
  // Single query: delete all sessions that are not in the most-recent N.
  // Atomic — no read/write gap for a race condition to exploit.
  await this.db.execute(sql`
    DELETE FROM user_session
    WHERE user_fk = ${userId}
      AND id NOT IN (
        SELECT id
        FROM   user_session
        WHERE  user_fk = ${userId}
        ORDER  BY created_at DESC
        LIMIT  ${maxAllowed}
      )
  `);
}
```

### `verifyClaims`

```typescript
async verifyClaims(jwtToken: string): Promise<VerifyClaimsResponse> {
  try {
    const payload = this.jwtConfigService.verifyToken(jwtToken);

    // FIX #8: use constant for audience validation
    if (payload.aud !== JWT_AUDIENCE) {
      throw new UnauthorizedException('Invalid JWT audience');
    }

    const user = await this.authUsersRepository.findByGuuid(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    const currentPermissions = await this.getUserPermissions(user.id);
    const currentRoles = currentPermissions.roles ?? [];
    const currentRoleCodes = currentRoles.map((r) => r.roleCode);
    const tokenRoles = (payload.roles as string[]) ?? [];

    // FIX #2: both arrays sorted before comparison — consistent with hashRoles fix
    const rolesChanged = !this.arraysEqual(
      [...currentRoleCodes].sort(),
      [...tokenRoles].sort(),
    );

    return {
      isValid:      true,
      sub:          payload.sub,
      rolesChanged,
      currentRoles: currentRoleCodes,
      stores:       currentRoles
                      .filter((r) => r.storeId)
                      .map((r) => ({ id: r.storeId, name: r.storeName })),
    };
  } catch (error) {
    this.logger.error(`JWT verification failed: ${error}`);
    return { isValid: false, rolesChanged: false };
  }
}
```

---

## 6. Mobile: auth client

```typescript
// apps/mobile/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { jwtClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL!,
  plugins: [
    expoClient({
      scheme:        'nks',
      storagePrefix: 'nks',
      storage:       SecureStore,
    }),
    jwtClient(),
  ],
});
```

---

## 7. Login flow — OTP end-to-end

```
User enters phone number
    │
    ▼
POST /api/auth/otp/send
  · Rate limit: 5 attempts / hour
  · Call MSG91 API → returns reqId
  · Store { phone, reqId, expiresAt } in otp_request_log
  · Return { reqId }
    │
    ▼
User receives SMS, enters 6-digit OTP
    │
    ▼
POST /api/auth/otp/verify  { phone, otp, reqId }
  · Validate OTP via MSG91
  · Mark reqId as used in otp_request_log
    │
    ▼
UserService.findOrCreateByPhone(phone)
  · Find or create user record
  · Set phoneNumberVerified = true
    │
    ▼
AuthFlowOrchestrator.executeAuthFlow(user, deviceInfo)
  · createSessionForUser(userId)              — session + session cookie
  · createTokenPair(guuid, sessionToken, ...) — access JWT (15 min) + opaque refresh (7 days)
  · buildAuthResponse(...)                    — offline JWT (3 days) + full envelope
    │
    ▼
HTTP 200 response
  Set-Cookie: better-auth.session_token (7 days, HttpOnly, Secure, SameSite=Lax)
  Set-Cookie: better-auth.session_data  (5 min, signed cache)
  Body: { user, session, tokens: { accessToken, refreshToken, offlineToken } }
    │
    ▼ Mobile app continues
    │
    ├── @better-auth/expo writes session_token → expo-secure-store
    ├── Write accessToken  → auth.jwt.access
    ├── Write offlineToken → auth.jwt.offline
    ├── Write refreshToken → auth.refresh.token
    ├── GET /api/v1/auth/nks-jwks → write RS256 JWKS → auth.jwks.cache
    ├── Compute device fingerprint → auth.device.fingerprint
    ├── Write user profile → auth.user.profile
    └── Write offline meta:
        { lastOnlineAt: now, offlineJwtExpMs: offlineToken.exp * 1000 }
        → auth.offline.meta
```

---

## 8. Login response — full breakdown

### HTTP response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: better-auth.session_token=at_XkQ9...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
Set-Cookie: better-auth.session_data=<signed>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300

{
  "user": {
    "guuid":                "01J5X8K2M3N4P6Q7R8S9T0U1V2",
    "email":                "driver@nks.com",
    "name":                 "Raj Kumar",
    "phoneNumber":          "+91 9876543210",
    "phoneNumberVerified":  true,
    "role":                 "driver"
  },
  "session": {
    "id":           "sess_01J5X8K2...",
    "expiresAt":    "2025-04-19T08:00:00.000Z",
    "activeStoreFk": 5
  },
  "tokens": {
    "accessToken":   "<RS256 JWT, exp: +15 min>",
    "refreshToken":  "<opaque 32-byte hex, exp: +7 days>",
    "offlineToken":  "<RS256 JWT, exp: +3 days>"
  }
}
```

### Access token JWT payload

```json
{
  "header": { "alg": "RS256", "typ": "JWT", "kid": "nks-key-a7f3e8c2" },
  "payload": {
    "sub":       "01J5X8K2...",
    "sid":       "sess-guuid",
    "email":     "driver@nks.com",
    "roles":     ["driver"],
    "jti":       "uuid-v4",
    "iss":       "nks-auth",
    "aud":       "nks-app",
    "iat":       1744444800,
    "exp":       1744445700
  }
}
```

`exp − iat = 900 s = 15 min`

### Offline token JWT payload

```json
{
  "header": { "alg": "RS256", "typ": "JWT", "kid": "nks-key-a7f3e8c2" },
  "payload": {
    "sub":           "01J5X8K2...",
    "email":         "driver@nks.com",
    "roles":         ["driver"],
    "stores":        [{ "id": 5, "name": "Store Chennai North" }],
    "activeStoreId": 5,
    "iss":           "nks-auth",
    "aud":           "nks-app",
    "iat":           1744444800,
    "exp":           1744704000
  }
}
```

`exp − iat = 259200 s = 3 days`

### What is written to SecureStore after login

```
auth.jwt.access      → <15-min RS256 access JWT>
auth.jwt.offline     → <3-day RS256 offline JWT>
auth.refresh.token   → <7-day opaque refresh token>
auth.jwks.cache      → '{"keys":[{"kty":"RSA","alg":"RS256","kid":"nks-key-a7f3e8c2",...}]}'
auth.device.fingerprint → "a7f3e8c2d1b9f4..."
auth.user.profile    → '{"guuid":"01J5X...","role":"driver","storeId":5}'
auth.offline.meta    → '{"lastOnlineAt":1744444800000,"offlineJwtExpMs":1744704000000}'
better-auth.session_token → "at_XkQ9mN3pL7..."
```

---

## 9. App startup — session hydration

```typescript
// apps/mobile/app/_layout.tsx
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/auth';
import { jwtManager } from '@/lib/jwt-manager';
import { deviceManager } from '@/lib/device-manager';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RootLayout');
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { hydrate } = useAuthStore();
  // FIX: use the hook, not getState() — the guard must re-render
  // when status changes (e.g. after reconnection restores 'authenticated')
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    async function prepare() {
      try {
        await jwtManager.hydrate();
        await deviceManager.verifyFingerprint();
        await hydrate();
      } catch (err) {
        logger.error('Hydration failed', err);
        useAuthStore.getState().setState({ status: 'unauthenticated' });
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!ready) return null;

  return (
    <Stack>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="login" />
      <Stack.Screen name="lock" />
    </Stack>
  );
}
```

### Hydration decision chain

```
App launches
    │
    ▼
jwtManager.hydrate()
  → Promise.all reads from SecureStore into memory:
      auth.jwt.access
      auth.jwt.offline
      auth.jwks.cache
      auth.offline.meta
      auth.device.fingerprint
    │
    ▼
deviceManager.verifyFingerprint()
  → Mismatch → log warning, continue
    (server checks X-Device-Fingerprint on next API call)
    │
    ▼
Token found?
    ├── No  → status = 'unauthenticated' → /login
    └── Yes → jwtManager.getOfflineStatus()
                  │
                  ├── offlineJwt valid (now < exp)
                  │       → status = 'authenticated' → /home
                  └── offlineJwt expired
                          → status = 'locked' → /lock
                            (data and queue preserved)
    │
    ▼
SplashScreen.hideAsync()
```

### Auth store (Zustand)

```typescript
// apps/mobile/src/stores/auth.ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type AuthStatus = 'idle' | 'authenticated' | 'locked' | 'unauthenticated';

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'idle',
  user:   null,
  mode:   'no-token',

  hydrate: async () => {
    const offlineStatus = jwtManager.getOfflineStatus();

    if (offlineStatus.mode === 'no-token') {
      set({ status: 'unauthenticated' });
    } else if (offlineStatus.mode === 'valid') {
      const raw  = await SecureStore.getItemAsync('auth.user.profile');
      const user = raw ? JSON.parse(raw) : null;
      set({ status: 'authenticated', mode: 'valid', user });
    } else {
      // mode === 'expired' — offline JWT past its own exp
      set({ status: 'locked', mode: 'expired' });
    }
  },

  setState: (partial) => set(partial),
}));
```

### Device fingerprint manager

```typescript
// apps/mobile/src/lib/device-manager.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createLogger } from './logger';

const logger = createLogger('DeviceManager');

class DeviceManager {
  private fingerprint: string | null = null;

  async verifyFingerprint(): Promise<boolean> {
    const stored  = await SecureStore.getItemAsync('auth.device.fingerprint');
    const current = await this.generateFingerprint();

    if (!stored) {
      // First login — persist and continue
      await this.persistFingerprint(current);
      return true;
    }

    if (current !== stored) {
      logger.warn('Device fingerprint mismatch — possible reinstall or OS update');
      return false;
    }
    return true;
  }

  async getFingerprint(): Promise<string> {
    if (this.fingerprint) return this.fingerprint;
    const stored = await SecureStore.getItemAsync('auth.device.fingerprint');
    if (stored) { this.fingerprint = stored; return stored; }
    return this.generateFingerprint();
  }

  async persistFingerprint(hash?: string): Promise<void> {
    const fp = hash ?? await this.generateFingerprint();
    this.fingerprint = fp;
    await SecureStore.setItemAsync('auth.device.fingerprint', fp);
  }

  private async generateFingerprint(): Promise<string> {
    // npx expo install react-native-device-info
    const DeviceInfo = require('react-native-device-info');
    const raw = [
      Platform.OS,
      DeviceInfo.getModel(),
      DeviceInfo.getVersion(),
    ].join('-');
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  }
}

export const deviceManager = new DeviceManager();
```

---

## 10. Mobile: JWTManager — aligned with dual-token design

The `JWTManager` is redesigned around the dual-token architecture. The offline token's own `exp` claim defines the offline window — no client-side grace period calculation is needed.

```typescript
// apps/mobile/src/lib/jwt-manager.ts
import { jwtDecode } from 'jwt-decode';
import * as SecureStore from 'expo-secure-store';
import { jwtVerify, createLocalJWKSet } from 'jose';
import { fetchWithTimeout } from './fetch-with-timeout';
import { createLogger } from './logger';

const logger = createLogger('JWTManager');

export type TokenMode = 'valid' | 'expired' | 'no-token';

export interface OfflineStatus {
  mode:           TokenMode;
  hoursRemaining: number;
  daysRemaining:  number;
  expMs:          number;
}

class JWTManager {
  // In-memory cache — zero I/O after hydrate() completes
  private accessToken:  string | null = null;
  private offlineToken: string | null = null;
  private jwks:         any    | null = null;
  private meta:         { lastOnlineAt: number; offlineJwtExpMs: number } | null = null;

  // ── Called once at app startup ────────────────────────────────────
  async hydrate(): Promise<void> {
    const [at, ot, jw, mt] = await Promise.all([
      SecureStore.getItemAsync('auth.jwt.access'),
      SecureStore.getItemAsync('auth.jwt.offline'),
      SecureStore.getItemAsync('auth.jwks.cache'),
      SecureStore.getItemAsync('auth.offline.meta'),
    ]);
    if (at) this.accessToken  = at;
    if (ot) this.offlineToken = ot;
    if (jw) this.jwks         = JSON.parse(jw);
    if (mt) this.meta         = JSON.parse(mt);
    logger.log('JWTManager hydrated');
  }

  // ── Offline window status — driven by offlineToken.exp ────────────
  // The server-issued offline JWT's own exp IS the window boundary.
  // No client-side grace period needed.
  getOfflineStatus(): OfflineStatus {
    const raw = this.offlineToken;
    if (!raw) return { mode: 'no-token', hoursRemaining: 0, daysRemaining: 0, expMs: 0 };

    const { exp } = jwtDecode<{ exp: number }>(raw);
    const nowMs   = Date.now();
    const expMs   = exp * 1000;

    const hoursRemaining = Math.max(0, (expMs - nowMs) / 3_600_000);
    const daysRemaining  = Math.max(0, hoursRemaining / 24);

    return {
      mode:           nowMs < expMs ? 'valid' : 'expired',
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      daysRemaining:  Math.round(daysRemaining  * 10) / 10,
      expMs,
    };
  }

  // ── Get access token for online API calls ─────────────────────────
  async getAccessToken(isOnline: boolean): Promise<string> {
    const raw = this.accessToken
      ?? await SecureStore.getItemAsync('auth.jwt.access');

    if (!raw) throw new Error('NO_ACCESS_TOKEN');

    const { exp } = jwtDecode<{ exp: number }>(raw);
    if (Date.now() < exp * 1000) {
      this.accessToken = raw;
      return raw;
    }

    // Expired — refresh if online
    if (isOnline) {
      await this.refreshFromServer();
      return this.accessToken!;
    }

    throw new Error('ACCESS_TOKEN_EXPIRED_OFFLINE');
  }

  // ── Offline JWT verification via cached JWKS ──────────────────────
  // Uses NKS RS256 JWKS (from /api/v1/auth/nks-jwks), NOT Better Auth's EdDSA JWKS
  async verifyOfflineToken(): Promise<Record<string, unknown>> {
    const raw = this.offlineToken
      ?? await SecureStore.getItemAsync('auth.jwt.offline');
    if (!raw) throw new Error('NO_OFFLINE_TOKEN');

    if (!this.jwks) {
      const cached = await SecureStore.getItemAsync('auth.jwks.cache');
      if (!cached) throw new Error('NO_JWKS_CACHE');
      this.jwks = JSON.parse(cached);
    }

    const [headerB64] = raw.split('.');
    const { kid } = JSON.parse(atob(headerB64));

    if (!this.jwks.keys.some((k: any) => k.kid === kid)) {
      throw new Error('JWKS_KEY_ROTATED');
    }

    const keySet = createLocalJWKSet(this.jwks);
    const { payload } = await jwtVerify(raw, keySet, {
      issuer:         'nks-auth',
      audience:       'nks-app',
      clockTolerance: 120,
    });

    return payload as Record<string, unknown>;
  }

  // ── Persist all tokens after refresh ─────────────────────────────
  async persistTokens(tokens: {
    accessToken:  string;
    offlineToken: string;
    refreshToken: string;
  }): Promise<void> {
    const { exp: offlineExp } = jwtDecode<{ exp: number }>(tokens.offlineToken);

    const meta = {
      lastOnlineAt:     Date.now(),
      offlineJwtExpMs:  offlineExp * 1000,
    };

    this.accessToken  = tokens.accessToken;
    this.offlineToken = tokens.offlineToken;
    this.meta         = meta;

    const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
    await Promise.all([
      SecureStore.setItemAsync('auth.jwt.access',    tokens.accessToken,  opts),
      SecureStore.setItemAsync('auth.jwt.offline',   tokens.offlineToken, opts),
      SecureStore.setItemAsync('auth.refresh.token', tokens.refreshToken, opts),
      SecureStore.setItemAsync('auth.offline.meta',  JSON.stringify(meta)),
    ]);
  }

  // ── Cache NKS RS256 JWKS (NOT Better Auth's EdDSA JWKS) ──────────
  async cacheJWKS(): Promise<void> {
    const res = await fetchWithTimeout(
      `${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/nks-jwks`,
      { timeoutMs: 10_000 },
    );
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const jwks = await res.json();
    this.jwks  = jwks;
    await SecureStore.setItemAsync('auth.jwks.cache', JSON.stringify(jwks));
    logger.log('NKS JWKS cache updated');
  }

  // ── Exchange refresh token for new token pair ─────────────────────
  async refreshFromServer(): Promise<void> {
    const refreshToken = await SecureStore.getItemAsync('auth.refresh.token');
    if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

    const fingerprint = await SecureStore.getItemAsync('auth.device.fingerprint') ?? '';

    const res = await fetchWithTimeout(
      `${process.env.EXPO_PUBLIC_API_URL}/api/auth/refresh`,
      {
        method:    'POST',
        headers:   {
          'Content-Type':         'application/json',
          'X-Device-Fingerprint': fingerprint,
        },
        credentials: 'include',
        body:        JSON.stringify({ refreshToken }),
        timeoutMs:   10_000,
      },
    );

    if (res.status === 401) throw new Error('REFRESH_FAILED_401');
    if (!res.ok)            throw new Error(`REFRESH_FAILED_${res.status}`);

    // Backend refreshAccessToken returns flat fields:
    //   { jwtToken, refreshToken, offlineToken, jwtExpiresAt, refreshTokenExpiresAt }
    // Map to the shape persistTokens() expects.
    const data = await res.json();
    await this.persistTokens({
      accessToken:  data.jwtToken,
      offlineToken: data.offlineToken,
      refreshToken: data.refreshToken,
    });
    logger.log('Token pair refreshed from server');
  }

  getCachedAccessToken():  string | null { return this.accessToken;  }
  getCachedOfflineToken(): string | null { return this.offlineToken; }
  getOfflineMeta() { return this.meta; }

  clearCache(): void {
    this.accessToken  = null;
    this.offlineToken = null;
    this.jwks         = null;
    this.meta         = null;
  }
}

export const jwtManager = new JWTManager();
```

---

## 11. Online operation — token refresh

```typescript
// apps/mobile/src/lib/jwt-refresh.ts
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { jwtDecode } from 'jwt-decode';
import { jwtManager } from './jwt-manager';
import { createLogger } from './logger';

const logger = createLogger('JWTRefresh');

export function registerProactiveRefresh() {
  const sub = AppState.addEventListener('change', async (state) => {
    if (state !== 'active') return;

    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || !net.isInternetReachable) return;

    const raw = jwtManager.getCachedAccessToken();
    if (!raw) return;

    const { exp } = jwtDecode<{ exp: number }>(raw);
    // Refresh if < 3 minutes remain on the 15-min access token
    if (exp - Date.now() / 1000 < 180) {
      try {
        await jwtManager.refreshFromServer();
        await jwtManager.cacheJWKS();
        logger.log('Proactive token refresh succeeded');
      } catch (err) {
        logger.warn('Proactive refresh failed — will retry on next API call', err);
      }
    }
  });
  return () => sub.remove();
}
```

---

## 12. Going offline — 3-day working window

### Timeline (NKS example)

```
Day 0, 09:00  Driver logs in online.
              accessToken:  exp = 09:15 (15 min)
              offlineToken: exp = Day 3, 09:00 (3 days)
              refreshToken: exp = Day 7 (7 days)
              Session cookie: exp = Day 7

Day 0, 09:30  Device goes offline.
              offlineToken still valid (3 days remaining).
              mode: 'valid' — full delivery operations continue.

Day 1         Countdown: "2d remaining" — green
Day 2, 09:00  Countdown: "1d remaining" — green
Day 2, 18:00  Countdown: "15h remaining" — amber
Day 3, 08:00  Countdown: "1h remaining" — red

Day 3, 09:00  offlineToken.exp reached.
              mode: 'expired'
              Lock screen shown.
              All queued mutations preserved in PowerSync SQLite.

Day 3, 10:00  Driver reconnects.
              refreshToken still valid (expires Day 7).
              POST /api/auth/refresh → new token pair issued.
              Full access restored within seconds.
```

### Mode decisions

```
getOfflineStatus()
    │
    ├── offlineToken missing → mode: 'no-token' → show login
    └── offlineToken present → check exp
          ├── now < exp → mode: 'valid'   → full read/write
          └── now > exp → mode: 'expired' → lock screen
                          (queue preserved until reconnect)
```

---

## 13. Offline data — reads and writes

### Write guard — prevents writes after offline JWT expires

The lock screen blocks the UI, but `powerSyncDb.execute()` is still callable at the database level from background handlers or third-party code. Mutations queued during the locked period would sync on reconnect under the fresh token — silently re-introducing writes the user made after their session should have been frozen. Every write function must check the offline status before touching SQLite:

```typescript
// apps/mobile/src/lib/write-guard.ts
import { jwtManager } from './jwt-manager';

/**
 * Throws if the offline JWT has expired.
 * Call at the top of every function that writes to PowerSync SQLite.
 * Reads are always allowed — only writes are gated.
 */
export function assertWriteAllowed(): void {
  const { mode } = jwtManager.getOfflineStatus();
  if (mode === 'expired' || mode === 'no-token') {
    throw new Error('OFFLINE_SESSION_EXPIRED');
  }
}
```

### Reads — always allowed, even after offline JWT expires

```typescript
// Reactive read in a component
import { useQuery } from '@powersync/react-native';

export function useRoutes(storeId: number) {
  const { data: routes } = useQuery<Route>(
    powerSyncDb,
    `SELECT * FROM routes
     WHERE store_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [storeId],
  );
  return routes ?? [];
}
```

### Writes — guarded, then instant and queued

```typescript
// apps/mobile/src/services/route-service.ts
import { assertWriteAllowed } from '@/lib/write-guard';
import { powerSyncDb } from '@/lib/powersync-db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('RouteService');

export async function updateRouteStatus(routeId: string, status: string) {
  // FIX #26: guard write — throws OFFLINE_SESSION_EXPIRED if offline JWT expired.
  // Without this, powerSyncDb.execute() succeeds even when the lock screen is shown,
  // and the mutation syncs on reconnect under the fresh token.
  assertWriteAllowed();

  const now = new Date().toISOString();
  await powerSyncDb.execute(
    `UPDATE routes
     SET status = ?, status_updated_at = ?, updated_at = ?
     WHERE id = ?`,
    [status, now, now, routeId],
  );
  // PowerSync detects the write and enqueues it for server sync
  logger.log(`Route ${routeId} status → ${status}`);
}

export async function createLocation(
  routeId: string,
  data: Omit<Location, 'id' | 'created_at' | 'updated_at'>,
): Promise<string> {
  assertWriteAllowed();

  const { uuidv7 } = await import('uuidv7');
  const id  = uuidv7();
  const now = new Date().toISOString();

  await powerSyncDb.execute(
    `INSERT INTO locations (id, route_id, name, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, routeId, data.name, now, now],
  );

  logger.log(`Location ${id} created (queued for sync)`);
  return id;
}
```

All writes succeed instantly when the offline JWT is valid. PowerSync records each mutation in its internal upload queue, keyed by a UUIDv7 idempotency key. The queue is SQLite-backed and survives app restarts, device reboots, and any number of days offline. After the offline JWT expires, all writes throw `OFFLINE_SESSION_EXPIRED` until the device reconnects and refreshes tokens.

---

## 14. Offline countdown and UI tiers

```typescript
// apps/mobile/src/hooks/useOfflineStatus.ts
import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { jwtManager } from '@/lib/jwt-manager';

type Urgency = 'online' | 'safe' | 'warn' | 'critical' | 'expired';

export function useOfflineStatus() {
  const [status, setStatus] = useState({
    isOnline:       true,
    urgency:        'online' as Urgency,
    daysRemaining:  null as number | null,
    hoursRemaining: null as number | null,
  });

  useEffect(() => {
    const check = async () => {
      const net      = await Network.getNetworkStateAsync();
      const isOnline = !!(net.isConnected && net.isInternetReachable);
      const offline  = jwtManager.getOfflineStatus();

      let urgency: Urgency = 'online';
      if (!isOnline) {
        if (offline.mode === 'expired')             urgency = 'expired';
        else if (offline.hoursRemaining < 1)        urgency = 'critical';
        else if (offline.daysRemaining  < 1)        urgency = 'critical';
        else if (offline.daysRemaining  < 2)        urgency = 'warn';
        else                                        urgency = 'safe';
      }

      setStatus({
        isOnline,
        urgency,
        daysRemaining:  offline.mode !== 'no-token' ? offline.daysRemaining  : null,
        hoursRemaining: offline.mode !== 'no-token' ? offline.hoursRemaining : null,
      });
    };

    check();
    const sub      = Network.addNetworkStateListener(check);
    const interval = setInterval(check, 60_000);
    return () => { sub.remove(); clearInterval(interval); };
  }, []);

  return status;
}
```

| Urgency | Condition | Banner text | Color |
|---|---|---|---|
| `online` | Connected | No banner | — |
| `safe` | Offline, >2 days left | "Working offline · Xd remaining" | Green |
| `warn` | Offline, 1–2 days left | "Connect soon · Xd left to sync" | Amber |
| `critical` | Offline, <1 day left | "Connect today · Xh remaining" | Red |
| `expired` | Offline token expired | "Offline limit reached — connect to continue" | Red |

---

## 15. Reconnection after long offline

Runs automatically when `expo-network` detects connectivity. Steps are always **sequential**.

```typescript
// apps/mobile/src/services/reconnection-handler.ts
import { powerSyncDb } from '@/lib/powersync-db';
import { jwtManager } from '@/lib/jwt-manager';
import { deviceManager } from '@/lib/device-manager';
import { useAuthStore } from '@/stores/auth';
import * as SecureStore from 'expo-secure-store';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { createLogger } from '@/lib/logger';
import { secureMMKV, auditMMKV } from '@/lib/mmkv';
import { queryClient } from '@/lib/query-client';
import { showReloginModal } from '@/lib/modals';

const logger = createLogger('ReconnectionHandler');

export async function handleReconnection(): Promise<void> {
  logger.log('Reconnection started');

  try {
    // ── Step 1: Revocation check ──────────────────────────────────
    logger.log('Step 1: Revocation check');
    const revokeRes = await fetchWithTimeout(
      `${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/session-status`,
      { credentials: 'include', timeoutMs: 10_000 },
    );

    if (revokeRes.ok) {
      const { revoked, wipe } = await revokeRes.json();
      if (wipe || revoked) {
        await performRemoteWipe();
        useAuthStore.getState().setState({ status: 'unauthenticated', user: null });
        return;
      }
    }

    // ── Step 2: Silent token refresh ─────────────────────────────
    // Uses the opaque refresh token (valid 7 days).
    // Returns new accessToken (15 min), offlineToken (3 days), refreshToken (7 days).
    logger.log('Step 2: Token refresh via POST /api/auth/refresh');
    try {
      await jwtManager.refreshFromServer();
    } catch (err: any) {
      if (err.message === 'REFRESH_FAILED_401') {
        logger.warn('Refresh token expired (>7 days) — re-login required');
        showReloginModal({ preserveQueue: true });
        return;
      }
      scheduleRetry(handleReconnection, 30_000);
      return;
    }

    // ── Step 3: Re-fetch NKS JWKS ────────────────────────────────
    // Server may have rotated its RS256 signing key (90-day rotation cycle).
    // Fetches from /api/v1/auth/nks-jwks (NOT Better Auth's /api/auth/jwks).
    logger.log('Step 3: NKS JWKS refresh');
    try {
      await jwtManager.cacheJWKS();
    } catch (err) {
      logger.warn('JWKS refresh failed — old cache may still be valid', err);
    }

    // ── Step 4: Drain PowerSync upload queue ─────────────────────
    // triggerCatchUp() tells PowerSync to process its upload queue.
    // PowerSync calls connector.uploadData() internally.
    logger.log('Step 4: PowerSync sync');
    await powerSyncDb.triggerCatchUp();
    await waitForSyncComplete(30_000);

    // ── Step 5: Restore full access ──────────────────────────────
    useAuthStore.getState().setState({ status: 'authenticated', mode: 'valid' });
    logger.log('Reconnection complete');

  } catch (err) {
    logger.error('Reconnection failed', err);
    scheduleRetry(handleReconnection, 60_000);
  }
}

function waitForSyncComplete(timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check current state first — if triggerCatchUp() completed before
    // the listener is registered, statusChanged never fires and we'd
    // wait the full timeout for nothing.
    const current = powerSyncDb.currentStatus;
    const alreadyIdle =
      !current.dataFlow.uploading &&
      !current.dataFlow.downloading &&
      current.hasSynced;

    if (alreadyIdle) { resolve(); return; }

    const timer = setTimeout(resolve, timeoutMs);
    const unsub = powerSyncDb.registerListener({
      statusChanged(status) {
        const idle = !status.dataFlow.uploading && !status.dataFlow.downloading;
        if (idle && status.hasSynced) {
          clearTimeout(timer);
          unsub();
          resolve();
        }
      },
    });
  });
}

async function performRemoteWipe(): Promise<void> {
  logger.warn('Performing remote wipe');

  await Promise.all([
    'auth.jwt.access', 'auth.jwt.offline', 'auth.refresh.token',
    'auth.jwks.cache', 'auth.offline.meta', 'auth.user.profile',
    'auth.device.fingerprint', 'better-auth.session_token',
  ].map((k) => SecureStore.deleteItemAsync(k)));

  secureMMKV.clearAll();
  auditMMKV.clearAll();

  // disconnectAndClear() is the correct PowerSync wipe API.
  // Raw SQL deletes on PowerSync-managed tables trigger sync events
  // and can corrupt sync state — never use them for wipe.
  await powerSyncDb.disconnectAndClear();

  jwtManager.clearCache();
  queryClient.clear();
  logger.warn('Remote wipe complete');
}

function scheduleRetry(fn: () => Promise<void>, delayMs: number): void {
  setTimeout(fn, delayMs);
}
```

### Reconnection scenarios

| Situation | What happens |
|---|---|
| < 7 days offline, refresh token valid | `POST /api/auth/refresh` succeeds, new token pair issued, sync runs, user never sees login |
| > 7 days offline, refresh token expired | Re-login modal shown. Queue preserved. Sync resumes after re-login. |
| Signing key rotated during offline | NKS JWKS re-fetched at step 3. New `kid` resolves. Transparent. |
| Admin revoked session | Step 1 catches it. Remote wipe. Login screen. |
| Device fingerprint mismatch | Server checks `X-Device-Fingerprint` during refresh → 401 → re-login. |
| Network drops mid-sync | PowerSync retries with exponential backoff automatically. |
| Idempotency key collision | Second push is a no-op. Idempotency log prevents double-write. |

---

## 16. Data sync — PowerSync

### Connector

```typescript
// apps/mobile/src/lib/powersync-connector.ts
import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  CrudEntry,
} from '@powersync/react-native';
import { deviceManager } from './device-manager';
import { fetchWithTimeout } from './fetch-with-timeout';
import { createLogger } from './logger';

const logger = createLogger('PowerSyncConnector');

export class BetterAuthConnector implements PowerSyncBackendConnector {

  async fetchCredentials() {
    const fingerprint = await deviceManager.getFingerprint();
    const res = await fetchWithTimeout(
      `${process.env.EXPO_PUBLIC_API_URL}/api/powersync/token`,
      {
        credentials: 'include',
        headers: { 'X-Device-Fingerprint': fingerprint },
        timeoutMs: 10_000,
      },
    );
    if (!res.ok) throw new Error(`PowerSync token: ${res.status}`);
    const { token, expiresAt } = await res.json();
    return { endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!, token,
             expiresAt: new Date(expiresAt) };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const fingerprint = await deviceManager.getFingerprint();
    let batch = 0;

    while (true) {
      const tx = await database.getNextCrudTransaction();
      if (!tx) break;

      const ops: CrudEntry[] = tx.crud.slice(0, 50);
      logger.log(`Batch ${++batch}: ${ops.length} ops`);

      const res = await fetchWithTimeout(
        `${process.env.EXPO_PUBLIC_API_URL}/api/v1/sync/push`,
        {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json',
                         'X-Device-Fingerprint': fingerprint },
          credentials: 'include',
          body:        JSON.stringify({ operations: ops }),
          timeoutMs:   30_000,
        },
      );

      if (res.status === 401) throw new Error('RE_AUTH_REQUIRED');
      if (!res.ok)            throw new Error(`PUSH_FAILED_${res.status}`);
      await tx.complete();
    }
  }
}
```

### Backend sync push handler (NestJS)

```typescript
// src/modules/sync/sync.controller.ts
import { Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@/common/guards/auth.guard';
import { db } from '@core/database/db';
import * as schema from '@core/database/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '@nestjs/common';

@Controller('v1/sync')
@UseGuards(AuthGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  @Post('push')
  async syncPush(@Req() req: Request) {
    const user       = (req as any).user;
    const operations: any[] = (req as any).body.operations ?? [];
    if (!Array.isArray(operations)) {
      throw new BadRequestException('operations must be an array');
    }

    const VALID_OPS = new Set(['PUT', 'PATCH', 'DELETE']);
    let processed = 0;

    for (const op of operations) {
      // Validate op type — reject unknown operations instead of
      // falling through to the insert/update path
      if (!VALID_OPS.has(op.op)) {
        this.logger.warn(`Unknown op "${op.op}" for ${op.id} — skipped`);
        continue;
      }

      const idempotencyKey = `${op.clientId}-${op.id}`;

      // Wrap check + mutation + idempotency log in a single transaction.
      // Without this, a crash between the mutation and the log write
      // causes re-processing on PowerSync's automatic retry.
      await db.transaction(async (tx) => {
        const seen = await tx.query.idempotencyLog.findFirst({
          where: eq(schema.idempotencyLog.key, idempotencyKey),
        });
        if (seen) {
          this.logger.log(`Duplicate skipped: ${idempotencyKey}`);
          return;  // skip — already processed
        }

        if (op.op === 'DELETE') {
          await tx.update(schema.routes)
            .set({ deletedAt: new Date() })
            .where(and(eq(schema.routes.id, op.id),
                       eq(schema.routes.storeId, user.activeStoreId)));

        } else {
          // op.op is 'PUT' or 'PATCH' (validated above)
          const server = await tx.query.routes.findFirst({
            where: and(eq(schema.routes.id, op.id),
                       eq(schema.routes.storeId, user.activeStoreId)),
          });

          if (!server) {
            // SECURITY: spread client data first, then override with
            // server-authoritative fields. Prevents a malicious client
            // from injecting storeId/id to write into another store.
            await tx.insert(schema.routes).values({
              ...op.opData,
              id:        op.id,
              storeId:   user.activeStoreId,
              createdAt: new Date(),
              updatedAt: new Date(),
              version:   1,
            });
          } else {
            const merged = this.fieldLevelMerge(server, op.opData);
            await tx.update(schema.routes)
              .set({ ...merged, updatedAt: new Date() })
              .where(eq(schema.routes.id, op.id));
            // version auto-incremented by PostgreSQL trigger
          }
        }

        // Idempotency log inside the same transaction — either both
        // the mutation and the log commit, or neither does.
        await tx.insert(schema.idempotencyLog).values({
          key: idempotencyKey, processedAt: new Date(),
        });
      });

      processed++;
    }

    return { ok: true, processed };
  }

  // Per-field timestamp merge: newer field value wins
  private fieldLevelMerge(
    server: Record<string, any>,
    client: Record<string, any>,
  ): Record<string, any> {
    const IMMUTABLE = new Set(['id', 'storeId', 'createdAt', 'version', 'deletedAt']);
    const merged = { ...server };

    for (const [key, clientValue] of Object.entries(client)) {
      if (IMMUTABLE.has(key) || key.endsWith('_updatedAt')) continue;

      const clientTs = client[`${key}_updatedAt`];
      const serverTs = server[`${key}_updatedAt`];

      if (serverTs && clientTs) {
        if (new Date(clientTs) > new Date(serverTs)) {
          merged[key] = clientValue;
          merged[`${key}_updatedAt`] = clientTs;
        }
      } else if (!serverTs && clientTs) {
        merged[key] = clientValue;
        merged[`${key}_updatedAt`] = clientTs;
      }
    }

    return merged;
  }
}
```

---

## 17. Database schema for sync

```typescript
// src/core/database/schema/routes.table.ts
import { pgTable, uuid, text, timestamp, integer, bigint, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const routes = pgTable('routes', {
  id:      uuid('id').primaryKey(),  // UUIDv7, client-generated
  storeId: bigint('store_id', { mode: 'number' })
             .notNull().references(() => store.id, { onDelete: 'cascade' }),

  name:   text('name').notNull(),
  status: text('status'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),  // tombstone
  version:   integer('version').notNull().default(1),

  // Per-field timestamps (conflict resolution)
  name_updatedAt:   timestamp('name_updated_at',   { withTimezone: true }),
  status_updatedAt: timestamp('status_updated_at', { withTimezone: true }),
}, (t) => [
  index('routes_delta_idx').on(t.storeId, t.updatedAt)
    .where(sql`${t.deletedAt} IS NULL`),
  index('routes_tombstones_idx').on(t.storeId, t.deletedAt)
    .where(sql`${t.deletedAt} IS NOT NULL`),
]);
```

```sql
-- Migration: version bump trigger with per-field timestamps
CREATE OR REPLACE FUNCTION bump_route_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version    = OLD.version + 1;
  IF NEW.name   IS DISTINCT FROM OLD.name   THEN NEW.name_updated_at   = NOW(); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_updated_at = NOW(); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_version_bump
  BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION bump_route_version();

-- Idempotency log (7-day TTL)
CREATE TABLE idempotency_log (
  key          TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Required PostgreSQL config for PowerSync WAL replication
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;
SELECT pg_reload_conf();

-- Cleanup (pg_cron, daily)
DELETE FROM routes          WHERE deleted_at   IS NOT NULL AND deleted_at   < NOW() - INTERVAL '90 days';
DELETE FROM idempotency_log WHERE processed_at < NOW() - INTERVAL '7 days';
```

---

## 18. Security hardening

### Certificate pinning

```typescript
// apps/mobile/index.ts — before any network calls
import { initializeSslPinning } from 'react-native-ssl-public-key-pinning';

await initializeSslPinning({
  'api.nks.com': {
    includeSubdomains: true,
    publicKeyHashes: [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',  // primary
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',  // backup
    ],
  },
});
```

### Inactivity lock (5-minute background timeout)

```typescript
// apps/mobile/src/hooks/useInactivityLock.ts
import { useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/stores/auth';

export function useInactivityLock() {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active' && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed > 5 * 60 * 1000) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage:          'Verify your identity to continue',
            biometricsSecurityLevel: 'strong',
          });
          if (!result.success) {
            useAuthStore.getState().setState({ status: 'locked' });
          }
        }
      }
    });
    return () => sub.remove();
  }, []);
}
```

### Biometric step-up for sensitive operations

```typescript
// apps/mobile/src/lib/biometric-gate.ts
import * as LocalAuthentication from 'expo-local-authentication';

export async function withBiometricGate<T>(
  action: () => Promise<T>,
  promptMessage = 'Verify your identity',
): Promise<T> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback:   false,
  });
  if (!result.success) throw new Error('BIOMETRIC_FAILED');
  return action();
}
```

---

## 19. Error handling reference

### OTP errors

| Code | HTTP | Cause | UI message |
|---|---|---|---|
| `INVALID_OTP` | 400 | Wrong OTP | "Incorrect OTP. Please try again." |
| `OTP_EXPIRED` | 400 | OTP older than 10 min | "OTP expired. Request a new one." |
| `REQ_ID_MISMATCH` | 400 | reqId doesn't match phone | "Invalid session. Start over." |
| `RATE_LIMITED` | 429 | >5 attempts/hour | "Too many attempts. Wait 15 min." |

### Auth errors (brute force / lockout)

| Code | HTTP | Cause | UI message |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password | "Incorrect email or password" |
| `ACCOUNT_BLOCKED` | 401 | Admin blocked account | "Account suspended — contact support" |
| `ACCOUNT_LOCKED` | 401 | ≥5 failed attempts | "Locked for 15 min due to failed attempts" |

### Token / session errors

| Error | Cause | Recovery |
|---|---|---|
| `NO_OFFLINE_TOKEN` | First launch, no token stored | Show login |
| `JWKS_KEY_ROTATED` | Offline JWT's `kid` not in cached NKS JWKS | Must reconnect |
| `NO_JWKS_CACHE` | NKS JWKS never fetched | Must reconnect |
| `REFRESH_FAILED_401` | Refresh token expired (>7 days) or revoked | Re-login modal |
| `REQUEST_TIMEOUT` | Network too slow | Retry |
| `DEVICE_MISMATCH` | Device fingerprint mismatch | Server revokes session — re-login |
| `SESSION_COMPROMISED` | Token reuse detected (theft) | All sessions wiped, re-login required |
| `OFFLINE_SESSION_EXPIRED` | Write attempted after offline JWT expired | Show lock screen; writes blocked until reconnect |

### Sync errors

| Status | Cause | Recovery |
|---|---|---|
| 401 during push | Session expired mid-sync | PowerSync calls `fetchCredentials()`, retries |
| 409 | Business-logic conflict | Mark as CONFLICT, surface to user |
| 429 | Rate limit | Exponential backoff (5 min → 15 min → 1 h) |
| 5xx | Backend down | PowerSync retries with backoff |

---

## 20. Configuration reference

| Setting | Value | Notes |
|---|---|---|
| Access token TTL | **15 min** | `createTokenPair`: `15 * 60 * 1000 ms` |
| Offline token TTL | **3 days** | `OFFLINE_JWT_EXPIRATION = '3d'` — controls mobile window |
| Opaque refresh TTL | **7 days** | Rolling window — resets on each refresh |
| Session cookie TTL | **7 days** | `session.expiresIn = 60 * 60 * 24 * 7` |
| JWKS rotation | 90 days | Server rotates signing key quarterly |
| JWKS grace period | 30 days | Old key trusted for 30 days after rotation |
| Max concurrent sessions | **5** | `MAX_CONCURRENT_SESSIONS = 5` |
| Max failed login attempts | 5 | `MAX_FAILED_ATTEMPTS = 5` |
| Lockout duration | 15 min | `LOCKOUT_MINUTES = 15` |
| Inactivity lock | 5 min | Background timeout before biometric required |
| PowerSync batch size | 50 ops | Per `/sync/push` request |
| Tombstone retention | 90 days | Soft-deleted rows kept for sync propagation |
| Idempotency log TTL | 7 days | Dedup window |
| Countdown warn | < 2 days | Amber banner |
| Countdown critical | < 1 day | Red banner |

### Backend environment variables

```env
BETTER_AUTH_URL=https://api.nks.com
BETTER_AUTH_SECRET=<min 32 chars>
DATABASE_URL=postgres://nks:password@db:5432/nks
POWERSYNC_URL=https://instance.powersync.journeyapps.com
POWERSYNC_PRIVATE_KEY=<RS256 private key PEM>
REDIS_URL=redis://redis:6379
IP_HMAC_SECRET=<high entropy secret for IP anonymisation>
```

### Mobile environment variables

```env
EXPO_PUBLIC_API_URL=https://api.nks.com
EXPO_PUBLIC_POWERSYNC_URL=https://instance.powersync.journeyapps.com
```

---

## 21. Change summary

All 26 issues identified across code review, architectural review, and final audit:

| # | Issue | Fix applied |
|---|---|---|
| 1 | `profileComplete` transaction callback ignored `tx` — all queries ran on the pool connection and rollback was impossible on failure | All repository calls inside the callback now accept an optional `tx?: Db` parameter and use `const conn = tx ?? this.db` |
| 2 | `hashRoles` was order-dependent — same role set in different DB row order produced different hashes, triggering false-positive `rolesChanged` on every refresh for multi-role users | Entries `.sort()`ed before `JSON.stringify` and hashing |
| 3 | `rotateSession` never validated `oldToken` — any caller who knew a `userId` could wipe all of that user's sessions | Token fetched by value, `session.userId === userId` verified, only that specific session deleted |
| 4 | `refreshAccessToken` parallel session updates not atomic — if revocation write failed, old refresh token remained valid and theft detection was permanently bypassed | Both updates wrapped in a single `db.transaction()` |
| 5 | `enforceSessionLimit` read-then-delete race condition — two concurrent logins both read count=5, neither deletes, user ends up with 7 sessions | Replaced with single atomic `DELETE ... NOT IN (SELECT ... LIMIT N)` SQL query |
| 6 | `offlineToken` (7-day JWT) conflicted with `JWTManager` client-side grace period — two competing sources of truth for the offline boundary | Dual-token architecture: `auth.jwt.offline` is a 3-day JWT whose own `exp` IS the boundary; mobile just checks the clock, no grace period calculation anywhere |
| 7 | JWT TTL hardcoded as 1 hour — misaligned with NKS 15-min spec | `createTokenPair` uses `15 * 60 * 1000 ms`; `OFFLINE_JWT_EXPIRATION = '3d'` as single source of truth for offline window |
| 8 | `aud` hardcoded as `'nks-app'` string literal in `createTokenPair`, `refreshAccessToken`, and `verifyClaims` — typo in any one location silently breaks verification | Extracted `const JWT_AUDIENCE = 'nks-app'` module-level constant used everywhere |
| 9 | `buildAuthResponse` comment and `refreshExpiresAt` calculation said 30 days — actual `session.expiresIn` config is 7 days | Comment corrected, calculation aligned to `7 * 24 * 60 * 60 * 1000` |
| 10 | `MAX_CONCURRENT_SESSIONS = 5` but inline comment said "> 10" — confusion about intended limit | Incorrect comment removed; constant is the single source of truth |
| 11 | RS256/EdDSA JWKS mismatch — mobile fetched Better Auth's `/api/auth/jwks` (EdDSA) but NKS tokens are signed RS256 by `JWTConfigService`; `jwtVerify` always failed | Added separate `/api/v1/auth/nks-jwks` exposing RS256 public key; mobile fetches only that endpoint |
| 12 | `signOfflineToken` had no TTL parameter — offline window hardcoded with no way to change it | Added `expiresIn: string = '3d'` parameter driven by `OFFLINE_JWT_EXPIRATION` constant |
| 13 | `auth.device.fp` key name in Section 8 vs `auth.device.fingerprint` everywhere else — fingerprint written at login never found by code reading it | Standardised to `auth.device.fingerprint` everywhere |
| 14 | `...op.opData` spread after `storeId` in sync push — malicious client could send `storeId: 999` in `opData` and write into another store's dataset | Spread order reversed: client data first, then server-authoritative `id`/`storeId`/`createdAt`/`updatedAt`/`version` override |
| 15 | `DeviceManager` class definition missing from document — `deviceManager.verifyFingerprint()` and `getFingerprint()` called but class existed nowhere | Re-added full class with `verifyFingerprint()`, `getFingerprint()`, `persistFingerprint()`, `generateFingerprint()` |
| 16 | `showReloginModal`, `secureMMKV`, `auditMMKV`, `queryClient` used in reconnection handler without imports — compile errors | Added explicit imports: `from '@/lib/modals'`, `from '@/lib/mmkv'`, `from '@/lib/query-client'` |
| 17 | `passwordService.hash()` (bcrypt/argon2, 100–300ms) ran inside `db.transaction()` holding a DB connection for the entire hash duration — exhausts pool under concurrent load | Hash computed before transaction opens; `passwordHash` passed into transaction body |
| 18 | `jwt.sign()` called in `signOfflineToken` without importing `jsonwebtoken` — `jwt` identifier unresolved | Added `import * as jwt from 'jsonwebtoken'` to `jwt.config.ts` |
| 19 | `refreshFromServer` destructured `const { tokens } = await res.json()` but backend returns flat `{ jwtToken, refreshToken, offlineToken }` — `tokens` always `undefined`, every refresh silently stored `undefined` into SecureStore | Changed to `const data = await res.json()` with explicit mapping: `data.jwtToken → accessToken` |
| 20 | `Stack.Protected guard` used `useAuthStore.getState().status` — one-time snapshot at render; after reconnection handler sets status to `authenticated`, component never re-rendered and guard stayed stale | Changed to reactive selector `useAuthStore((s) => s.status)` which triggers re-render on every status change |
| 21 | `syncPush` check-mutate-log were three separate unguarded DB calls — crash between mutation and log write left route written but idempotency key unlogged; retry caused unique constraint violation (INSERT) or extra version increment (UPDATE) | All three steps wrapped in single `db.transaction(async (tx) => { ... })` — atomic commit or full rollback |
| 22 | `op.op` not validated in sync push — any string not `'DELETE'` fell through to insert/update path; malicious `op.op: 'TRUNCATE'` treated as upsert | Added `const VALID_OPS = new Set(['PUT', 'PATCH', 'DELETE'])` — unknown ops logged and skipped |
| 23 | `operations` not guarded against `undefined` — missing field threw `TypeError: operations is not iterable` (500 instead of 400) | Added `?? []` fallback + `Array.isArray()` check throwing `BadRequestException` |
| 24 | `waitForSyncComplete` didn't check current status before registering listener — if `triggerCatchUp()` completed before listener registered, `statusChanged` never fired and function waited full 30s timeout | Added `powerSyncDb.currentStatus` check before listener; resolves immediately if already idle |
| 25 | `BadRequestException` used in `syncPush` but not imported from `@nestjs/common` — TypeScript compile error | Added to import: `{ Controller, Post, Req, UseGuards, BadRequestException }` |
| 26 | No write guard after offline JWT expires — lock screen blocked UI but `powerSyncDb.execute()` still callable from background handlers; mutations queued during locked period would sync on reconnect under fresh token | Added `assertWriteAllowed()` guard that checks `jwtManager.getOfflineStatus().mode` and throws `OFFLINE_SESSION_EXPIRED` if expired; called at top of every write function |

---

*NKS · Expo SDK 53 · NestJS 10 · Better Auth 1.x · PowerSync SDK 1.x · PostgreSQL 16 · Drizzle ORM 0.30+*
