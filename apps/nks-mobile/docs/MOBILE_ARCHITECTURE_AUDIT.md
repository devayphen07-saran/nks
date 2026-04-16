# ADR-001: NKS Mobile — Architecture, Routing & Setup Audit

**Status:** Active Review  
**Date:** April 2026  
**Scope:** Full mobile architecture, Expo Router, auth guard flow, folder structure, configuration  
**Auditor:** Technical Audit  

---

## Executive Summary

| Category | Score | Grade |
|----------|-------|-------|
| Folder Structure | 88/100 | B+ |
| Expo Router Setup | 72/100 | C+ |
| Auth Guard Flow | 91/100 | A- |
| Security Setup | 85/100 | B+ |
| Configuration & Build | 58/100 | D+ |
| Dependencies & Tooling | 65/100 | D+ |
| **Overall** | **77/100** | **B** |

**Verdict:** The security and auth guard architecture is excellent and enterprise-grade. However, the **build/deployment configuration has critical gaps** that MUST be fixed before any production release. The Expo Router nesting is overly complex and needs flattening.

---

## Part 1: Folder Structure Analysis

### 1.1 Current Structure

```
nks-mobile/
├── app/                    ← Expo Router file-based routes
│   ├── _layout.tsx        ← Root layout (providers)
│   ├── (auth)/            ← Auth group
│   │   ├── _layout.tsx
│   │   ├── phone.tsx
│   │   └── otp.tsx
│   └── (protected)/       ← Auth-gated group
│       ├── _layout.tsx
│       └── (workspace)/
│           ├── _layout.tsx
│           ├── index.tsx  ← Role-based redirect
│           └── (app)/
│               ├── _layout.tsx
│               ├── (onboarding)/
│               ├── (personal)/
│               │   ├── _layout.tsx  ← Drawer
│               │   └── (tabs)/      ← Tabs inside Drawer
│               └── (store)/
│                   └── _layout.tsx  ← Drawer
│
├── features/               ← Feature modules (UI layer)
│   ├── auth/
│   ├── personal/
│   ├── store/
│   ├── workspace/
│   ├── user/
│   ├── settings/
│   └── shared/
│
├── lib/                    ← Core business logic (26 files)
│   ├── auth-provider.tsx
│   ├── jwt-manager.ts
│   ├── jwt-refresh.ts
│   ├── axios-interceptors.ts
│   ├── offline-session.ts
│   ├── ssl-pinning.ts
│   ├── write-guard.ts
│   ├── device-manager.ts
│   ├── token-mutex.ts
│   ├── server-time.ts
│   └── ...
│
├── store/                  ← Redux state
│   ├── index.ts
│   ├── auth-slice.ts
│   ├── initialize-auth.ts
│   ├── refresh-session.ts
│   ├── logout-thunk.ts
│   └── ...
│
├── hooks/                  ← App-level hooks
├── services/               ← Service handlers
├── components/             ← Shared UI components
├── shared/                 ← Shared types & errors
├── assets/
└── docs/
```

### 1.2 What Is Good ✅

- **Feature-based organization** — `features/` is logically split by domain (auth, personal, store, workspace, user, settings)
- **Clear layer separation** — UI (`features/`) → Hooks → Lib (business logic) → Store (state)
- **Centralized lib/** — All security, token, and offline logic lives in `lib/`, not scattered in features
- **Named route groups** — Expo Router groups `(auth)` and `(protected)` clearly communicate intent
- **Centralized constants** — `lib/storage-keys.ts`, `lib/routes.ts` prevent magic strings

### 1.3 Issues Found ❌

#### Issue 1: Route Nesting Too Deep (HIGH)

**Current deepest path:**
```
/(protected)/(workspace)/(app)/(personal)/(tabs)/dashboard
```
That is **6 route group levels** deep. This creates:
- Hard-to-debug navigation issues
- Confusing URL structure
- Multiple loading states stacking (each layout renders its own loading)
- Complex `<Stack>` inside `<Drawer>` inside `<Stack>` nesting

**Recommended structure:**
```
/(auth)/
  phone.tsx
  otp.tsx

/(protected)/
  _layout.tsx              ← single auth guard here
  index.tsx                ← role-based redirect
  
  (onboarding)/
    account-type.tsx
    profile-setup.tsx
    accept-invite.tsx
  
  (personal)/
    _layout.tsx            ← Drawer + Tabs here
    dashboard.tsx
    expense.tsx
    profile.tsx
  
  (store)/
    _layout.tsx            ← Drawer here
    list.tsx
    setup.tsx
    [storeId]/
      dashboard.tsx
      products.tsx
      orders.tsx
      staff.tsx
      pos.tsx
```

**Savings:** 4 levels → 2 levels. Eliminates `(workspace)` and `(app)` wrappers that add no routing value.

---

#### Issue 2: `(workspace)` Group Has No Purpose (MEDIUM)

`(workspace)/_layout.tsx` only checks `isInitializing` — which is already handled by `(protected)/_layout.tsx`. This creates a **double-loading state** that can show `<LoadingFallback>` twice.

**Fix:** Merge `(workspace)` into `(protected)` directly.

---

#### Issue 3: `services/` Folder Underutilized (LOW)

Only 1 file: `reconnection-handler.ts`. The rest of the "service" logic lives scattered in `lib/`. Recommendation: either move more to `services/` or consolidate `reconnection-handler.ts` into `lib/`.

---

#### Issue 4: No `tests/` or `__tests__/` Directory (HIGH)

Zero test files found anywhere in the mobile app. No unit tests, no integration tests, no component tests.

**Industry standard:** Minimum 70% coverage on business logic (`lib/`, `store/`, `features/hooks/`).

---

## Part 2: Expo Router Setup Analysis

### 2.1 Version: expo-router `~6.0.23`

This is Expo Router **v6** — a major leap over v3/v4 with:
- Typed routes support (`@/app` type-safe params)
- Improved group layouts
- Better `<Redirect>` component

**However**, you are running **React 19.1.0** with Expo 54. This is a bleeding-edge combination. Verify `expo-router@6` is officially tested with React 19 in the Expo SDK 54 changelog.

### 2.2 Entry Point Configuration ✅

```json
"main": "expo-router/entry"
```
Correct. This delegates root rendering to Expo Router.

### 2.3 Scheme Configuration ✅

```json
"scheme": "nks-mobile"
```
Correct for deep linking.

### 2.4 Auth Guard Pattern

**Current implementation:**

```tsx
// app/(protected)/_layout.tsx
const { isLoggedIn, isLoading } = useAuthGuard();

if (isLoading) return <LoadingFallback />;
if (!isLoggedIn) return <Redirect href="/(auth)/phone" />;
return <Stack />;
```

```tsx
// app/(auth)/_layout.tsx
const { isLoggedIn } = useAuthGuard();

if (isLoggedIn) return <Redirect href="/(protected)/(workspace)" />;
return <Stack />;
```

**Assessment:** This is the **correct Expo Router auth pattern** — using `<Redirect>` inside layouts, checking auth state from context, no middleware files needed.

### 2.5 Issues Found ❌

#### Issue 5: Auth Redirect Goes to Wrong Target (MEDIUM)

```tsx
// app/(auth)/_layout.tsx — CURRENT
if (isLoggedIn) return <Redirect href="/(protected)/(workspace)" />;
```

This redirects to `(workspace)` which then renders `(workspace)/index.tsx` which does role-based redirect. This is **correct behavior** but creates an **extra navigation hop**. The auth layout should redirect to `/(protected)` and let the protected group's index handle role routing.

**Fix:**
```tsx
if (isLoggedIn) return <Redirect href="/(protected)" />;
```

---

#### Issue 6: No `+not-found.tsx` Route (MEDIUM)

Expo Router requires a `+not-found.tsx` to handle unmatched routes. Without it:
- Invalid deep links crash the app
- Typos in navigation params cause blank screens

**Fix:** Create `app/+not-found.tsx`:
```tsx
import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found' }} />
      <View>
        <Text>This screen doesn't exist.</Text>
        <Link href="/(protected)">Go to home screen</Link>
      </View>
    </>
  );
}
```

---

#### Issue 7: No Typed Routes Configured (LOW)

Expo Router v6 supports **typed routes** which gives type-safe navigation params. Currently not enabled.

**Fix in app.json:**
```json
"experiments": {
  "typedRoutes": true
}
```

Then use:
```tsx
router.push('/(auth)/otp'); // TypeScript checks valid routes
```

---

#### Issue 8: Missing `expo-router` Plugin Version Config (LOW)

```json
"plugins": ["expo-router"]
```

Should pin the router origin for web (if needed) and set the root:
```json
"plugins": [
  [
    "expo-router",
    {
      "root": "./app",
      "origin": "https://nks-mobile.com"
    }
  ]
]
```

---

## Part 3: Auth Guard Flow Analysis

### 3.1 Overall Auth Flow ✅ EXCELLENT

The auth flow is well-designed with multiple security layers:

```
App Start
  │
  ├─ SSL Pinning check (blocks launch if MITM detected)
  │
  ├─ Redux store initializes
  │
  ├─ initializeAuth() thunk runs:
  │    ├─ 1. One-time PII migration (AsyncStorage → SecureStore)
  │    ├─ 2. JWTManager hydrate (load all 3 tokens)
  │    ├─ 3. Rate limiter restore (OTP lockout state)
  │    ├─ 4. Load session from SecureStore
  │    ├─ 5. Validate session structure (required fields)
  │    ├─ 6. Validate session expiry (server-adjusted time)
  │    ├─ 7. Validate token format (regex check)
  │    ├─ 8. Set in-memory token
  │    ├─ 9. Restore offline session
  │    └─ 10. Background refresh if >12 min stale
  │
  ├─ AuthProvider renders:
  │    ├─ isLoggedIn = Redux.isAuthenticated
  │    ├─ isLoading = Redux.isInitializing
  │    ├─ Sets up Axios interceptors
  │    ├─ Sets up network listener
  │    └─ Registers biometric inactivity lock
  │
  └─ Expo Router renders:
       ├─ (auth)/_layout: if logged in → redirect protected
       └─ (protected)/_layout: if not logged in → redirect auth
```

### 3.2 Token Lifecycle ✅ EXCELLENT

```
Online Flow:                    Offline Flow:
accessToken (15 min)           offlineToken (3 days)
      │                              │
      ▼                              ▼
401 response                  write-guard.ts checks:
      │                         - JWT expiry
      ▼                         - Role validation
tokenMutex.withRefreshLock()   - HMAC signature
      │                              │
      ▼                              ▼
refreshTokenAttempt()         Allow or block write
      │
      ▼
POST /auth/refresh-token
      │
 ┌────┴────┐
 │ success │ fail (shouldLogout)
 │         │
update    force logout
tokens    + clear all
```

### 3.3 Issues Found ❌

#### Issue 9: `(workspace)/_layout.tsx` Creates Redundant Loading State (HIGH)

```tsx
// app/(protected)/_layout.tsx
if (isLoading) return <LoadingFallback />;  // ← First loading gate
if (!isLoggedIn) return <Redirect />;

// app/(protected)/(workspace)/_layout.tsx  
const { isInitializing } = useAuth();
if (isInitializing) return <LoadingFallback />;  // ← SECOND loading gate (same check!)
```

`isLoading` in the protected layout IS `isInitializing` from Redux. Both layouts check the same condition, meaning the app could show loading screen twice.

**Fix:** Remove the `isInitializing` check from `(workspace)/_layout.tsx`. Let `(protected)/_layout.tsx` handle it exclusively.

---

#### Issue 10: `useAuthGuard` Hook Name Collision (LOW)

```tsx
// lib/auth-provider.tsx
export const useAuthGuard = () => useContext(AuthContext);
```

The hook returns `{ isLoggedIn, isLoading }` — it's a **context accessor**, not a "guard". Naming it `useAuthGuard` implies it blocks execution, but it only reads state. This misleads developers.

**Recommended rename:**
```tsx
export const useAuth = () => useContext(AuthContext);
// or
export const useAuthState = () => useContext(AuthContext);
```

Currently there are TWO `useAuth` hooks:
- `lib/auth-provider.tsx` → `useAuthGuard()` (context, returns `isLoggedIn/isLoading`)
- `store/index.ts` → `useAuth()` (Redux selector, returns `isInitializing/isAuthenticated/authResponse`)

This naming is confusing. Standardize:
- `useAuthContext()` → for the React context (isLoggedIn, isLoading)
- `useAuthState()` → for Redux (full auth state)

---

#### Issue 11: Logout Does NOT Clear Local SQLite Tables During Logout for Non-Shared Devices (MEDIUM)

```tsx
// store/logout-thunk.ts
// 9. Clear local SQLite database
await localDb.clearAllTables();

// 10. Clear DB encryption key (shared devices)
if (IS_SHARED_DEVICE) {
  await dbKey.deleteKey();
}
```

`clearAllTables()` is called for ALL devices (good), but `deleteKey()` is only called for shared devices. This means:
- Same user logs back in → same DB key → risk of data persistence between sessions on same device
- Different user on same device (non-shared mode) → can access previous user's schema (even if tables cleared)

**Fix:** Always delete and regenerate the DB encryption key on logout. Cost: minor (~100ms DB re-init on next login).

---

#### Issue 12: `IS_SHARED_DEVICE` Is a Build-Time Constant (MEDIUM)

```tsx
// lib/device-config.ts
export const IS_SHARED_DEVICE = false; // hardcoded
```

This means a POS terminal that should be shared device mode can never be configured without a rebuild.

**Fix:** Read from environment variable at build time or SecureStore preference set during device enrollment:
```tsx
export const IS_SHARED_DEVICE = 
  process.env.EXPO_PUBLIC_SHARED_DEVICE === 'true' || false;
```

---

#### Issue 13: No Session Revocation Check On App Foreground (MEDIUM)

The reconnection handler checks revocation when coming **online from offline**. But there's no check when the app comes from **background to foreground** while online.

**Scenario:**
1. User's device is compromised
2. Admin revokes user session on backend
3. User opens app from background (was already online)
4. No revocation check → user still appears logged in

**Fix:** On AppState change to 'active' (from background, if online), make lightweight call to `GET /auth/session-status`.

---

## Part 4: Security Setup Analysis

### 4.1 What Is Excellent ✅

| Feature | Implementation | Status |
|---------|---------------|--------|
| SSL Pinning | `react-native-ssl-public-key-pinning` with dual pins | ✅ |
| Token Storage | All tokens in `expo-secure-store` | ✅ |
| Token Rotation | Refresh token rotation with theft detection | ✅ |
| Token Mutex | Prevents race condition on refresh/logout | ✅ |
| Biometric Lock | 5-min inactivity → biometric re-auth | ✅ |
| Device Binding | SHA-256 fingerprint sent on every request | ✅ |
| DB Encryption | SQLCipher via expo-sqlite | ✅ |
| Log Sanitization | Tokens/OTPs/emails stripped from logs | ✅ |
| Server Time Sync | Clock offset prevents premature token expiry | ✅ |
| Offline Integrity | HMAC-SHA256 signature on offline session | ✅ |
| Rate Limiting | OTP: 5/5min, send: 3/15min, resend: 2/10min | ✅ |
| Write Guards | Offline writes gated on JWT expiry + role | ✅ |

### 4.2 Issues Found ❌

#### Issue 14: SSL Pin Expiry Not Checked At Runtime (HIGH)

```tsx
// lib/ssl-pinning.ts
// Pins expire — hard fail in production if expiration date passed
```

The comment says pins can expire, but there's no runtime check that warns when pins are approaching expiration. If pins expire silently, all network calls will fail in production.

**Fix:** On app startup, compare `EXPO_PUBLIC_SSL_PIN_EXPIRY` against current date and:
- 30 days before expiry → log warning
- 7 days before expiry → show in-app warning to update
- Past expiry → force update prompt

---

#### Issue 15: JWKS Cache Can Be Stale for 7 Days Without Warning (MEDIUM)

```tsx
// lib/jwt-manager.ts
// Stale cache limit: 7 days (conservative margin before backend 30-day rotation)
// On cache miss: skips verification, relies on offline session's own expiry
```

7-day JWKS staleness + "skip verification on cache miss" means offline JWT verification can be silently skipped. This weakens the offline integrity guarantee.

**Fix:** Never skip verification on cache miss. Instead, if JWKS unavailable offline, reject the operation and prompt to go online for a fresh sync.

---

#### Issue 16: Device HMAC Secret in Environment Variable (LOW)

```tsx
// lib/device-binding.ts
// Note: client-side HMAC is UX guard, not crypto boundary — secret can be extracted
// True device attestation requires Apple DeviceCheck / Google Play Integrity API
```

The codebase acknowledges this. For a POS system, consider upgrading to Apple DeviceCheck / Google Play Integrity for true device attestation. Current implementation is UX-level security only.

**Priority:** Low for v1, add to v2 security roadmap.

---

## Part 5: Configuration & Build Setup

### 5.1 Critical Gaps ❌

#### Issue 17: `app.json` Missing Android Permissions (CRITICAL)

**Current `android` block:**
```json
"android": {
  "package": "com.nks.mobile",
  "adaptiveIcon": { ... },
  "predictiveBackGestureEnabled": false
}
```

**Missing permissions** required for POS functionality:
```json
"android": {
  "package": "com.nks.mobile",
  "permissions": [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.CAMERA",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
    "android.permission.VIBRATE",
    "android.permission.RECEIVE_BOOT_COMPLETED"
  ]
}
```

Without explicit permission declarations, Android 14+ builds may fail or silently deny capabilities.

---

#### Issue 18: `eas.json` Missing Environment Variable Configuration (CRITICAL)

**Current:**
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "developmentClient": true, "distribution": "internal" },
    "production": { "autoIncrement": true }
  }
}
```

**Missing:** Environment-specific configuration:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://10.10.98.72:4000/api/v1",
        "EXPO_PUBLIC_ENV": "development"
      }
    },
    "preview": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.staging.nks.com/api/v1",
        "EXPO_PUBLIC_ENV": "preview"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.nks.com/api/v1",
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  }
}
```

**Risk:** Without this, all builds use `.env.local` which points to `http://10.10.98.72:4000` — your development machine's local IP. Production builds will fail to connect.

---

#### Issue 19: No `metro.config.js` for Monorepo (CRITICAL)

The app is part of a **pnpm NX monorepo** with workspace packages (`@nks/api-manager`, `@nks/mobile-theme`, etc.). Without a custom `metro.config.js`, Metro bundler **cannot resolve these workspace packages**.

This works in development only because `nodeLinker: hoisted` in `pnpm-workspace.yaml` makes packages available at root `node_modules`. In production EAS builds, hoisting is not guaranteed.

**Fix:** Create `apps/nks-mobile/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root
const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve workspace packages
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve package names to their source directories
config.resolver.extraNodeModules = {
  '@nks/api-manager': path.resolve(monorepoRoot, 'libs-common/api-manager/src'),
  '@nks/mobile-theme': path.resolve(monorepoRoot, 'libs-mobile/mobile-theme/src'),
  '@nks/mobile-ui-components': path.resolve(monorepoRoot, 'libs-mobile/mobile-ui-components/src'),
  '@nks/mobile-utils': path.resolve(monorepoRoot, 'libs-mobile/mobile-utils/src'),
  '@nks/mobile-i18n': path.resolve(monorepoRoot, 'libs-mobile/mobile-i18n/src'),
  '@nks/common-i18n': path.resolve(monorepoRoot, 'libs-common/i18n/src'),
  '@nks/shared-types': path.resolve(monorepoRoot, 'libs-common/shared-types/src'),
  '@nks/state-manager': path.resolve(monorepoRoot, 'libs-common/state-manager/src'),
  '@nks/local-db': path.resolve(monorepoRoot, 'libs-mobile/local-db/src'),
  '@nks/utils': path.resolve(monorepoRoot, 'libs-common/utils/src'),
};

module.exports = config;
```

---

#### Issue 20: `owner` Is a Personal Account (MEDIUM)

```json
"owner": "saranr123"
```

This should be your organization's EAS account, not a personal account. All production builds, updates (OTA), and submission credentials are tied to this owner.

**Fix:** Create an organization account on expo.dev and transfer the project.

---

#### Issue 21: No `userInterfaceStyle: "automatic"` (LOW)

```json
"userInterfaceStyle": "light"
```

Hard-coded to light mode. Modern apps should respect the OS dark mode preference.

**Fix:**
```json
"userInterfaceStyle": "automatic"
```

---

### 5.2 Missing Configuration Files

| File | Status | Impact |
|------|--------|--------|
| `metro.config.js` | ❌ Missing | CRITICAL — EAS builds may fail |
| `.eslintrc.js` | ❌ Missing | HIGH — No lint enforcement |
| `.prettierrc` | ❌ Missing | MEDIUM — No formatting standard |
| `jest.config.js` | ❌ Missing | HIGH — No test runner configured |
| `.env.development` | ❌ Missing | HIGH — No env separation |
| `.env.production` | ❌ Missing | HIGH — No production env |
| `sentry.config.js` | ❌ Missing | MEDIUM — No crash reporting |

---

## Part 6: Dependencies Analysis

### 6.1 Redundant State Managers (MEDIUM)

Both **Redux Toolkit** and **Zustand** are installed:
- `@reduxjs/toolkit@^2.5.0` — used for auth + store state
- `zustand@^5.0.12` — present but usage unclear

**Risk:** Two state management solutions increase bundle size and confuse developers on which to use.

**Fix:** Pick one. Given Redux is already used for auth and the backend state package `@nks/state-manager` likely uses Redux, **remove Zustand** unless it's explicitly used in a specific feature.

---

### 6.2 Version Matrix Issues

| Package | Current | Issue |
|---------|---------|-------|
| `expo-router` | `~6.0.23` | v6 is stable — verify Expo 54 compatibility |
| `react` | `19.1.0` | Very new — confirm all RN packages support React 19 |
| `react-native` | `0.81.5` | Latest in Expo 54 — correct |
| `jose` | `^6.2.2` | v6 — JWT library. Verify node/RN compatibility |
| `styled-components` | `^6.3.11` | v6 — confirm `@types/styled-components-react-native` |
| `zod` | `^4.3.6` | v4 — new, confirm `@hookform/resolvers` supports Zod v4 |

---

### 6.3 Missing Critical Dependencies

| Package | Why Needed |
|---------|-----------|
| `@sentry/react-native` | Crash reporting for production |
| `expo-updates` | OTA updates support |
| `react-native-mmkv` | Faster storage for non-sensitive data vs AsyncStorage |
| `@testing-library/react-native` | Component testing |
| `jest-expo` | Test runner for Expo |

---

### 6.4 Potentially Unused Dependencies

| Package | Check |
|---------|-------|
| `zustand` | No clear usage found — remove if unused |
| `expo-contacts` | POS app shouldn't need contacts — remove |
| `expo-clipboard` | Only if copy-to-clipboard is used in UI |
| `@react-native-async-storage/async-storage` | Should only be used for rate limiter persistence, not tokens |

---

## Part 7: Overall Recommendations

### Priority 1: MUST FIX BEFORE PRODUCTION (Week 1)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 19 | No metro.config.js | Create with monorepo paths | 1h |
| 18 | EAS.json missing env vars | Add per-environment API URLs | 30min |
| 17 | app.json missing Android permissions | Add permissions array | 30min |
| 11 | DB key not deleted on logout | Always delete + regenerate | 1h |

---

### Priority 2: ARCHITECTURE IMPROVEMENTS (Sprint 1)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 1 | Route nesting 6 levels deep | Flatten to 2-3 levels | 4h |
| 2 | `(workspace)` group no purpose | Merge into `(protected)` | 2h |
| 9 | Double loading state | Remove redundant isInitializing check | 1h |
| 6 | No +not-found.tsx | Create 404 route | 30min |
| 13 | No revocation check on foreground | Add AppState listener | 2h |

---

### Priority 3: TOOLING & QUALITY (Sprint 2)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 21 | No ESLint config | Add eslintrc with RN rules | 1h |
| 22 | No Prettier config | Add prettierrc | 30min |
| 23 | No Jest config | Add jest.config.js + test setup | 2h |
| 24 | No test files | Write tests for lib/ + store/ | 16h |
| 20 | Personal EAS owner | Transfer to org account | 1h |
| 10 | Hook naming confusion | Rename useAuthGuard → useAuthContext | 1h |
| 5 | Redundant Zustand dep | Remove if unused | 30min |

---

### Priority 4: SECURITY HARDENING (Sprint 3)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 14 | SSL pin expiry warning | Add runtime expiry check | 2h |
| 15 | JWKS skip verification | Never skip, reject instead | 1h |
| 7 | No typed routes | Enable typedRoutes experiment | 30min |
| 12 | IS_SHARED_DEVICE hardcoded | Drive from env var | 1h |

---

## Part 8: Industry Grade Checklist

### Core Setup
- [x] Expo Router file-based routing
- [x] Proper entry point (`expo-router/entry`)
- [x] TypeScript strict mode
- [x] Path aliases in tsconfig
- [x] Feature-based folder structure
- [ ] **`metro.config.js` for monorepo** ← MISSING
- [ ] **`.eslintrc.js`** ← MISSING
- [ ] **`.prettierrc`** ← MISSING

### Auth & Security
- [x] JWT access + offline + refresh tokens
- [x] Token stored in SecureStore
- [x] SSL certificate pinning
- [x] Biometric inactivity lock
- [x] Device binding / fingerprinting
- [x] Token mutex (race condition prevention)
- [x] Server time synchronization
- [x] HMAC-SHA256 offline session integrity
- [x] Comprehensive logout (all state cleared)
- [x] Rate limiting (OTP, send, resend)
- [ ] **Session revocation check on foreground** ← MISSING
- [ ] **PKCE for OAuth** ← MISSING (backend side)
- [ ] **SSL pin expiry monitoring** ← MISSING

### Routing
- [x] Auth group with redirect for authenticated users
- [x] Protected group with redirect for unauthenticated users
- [x] Role-based redirect after auth
- [x] Centralized route constants
- [ ] **`+not-found.tsx` 404 handler** ← MISSING
- [ ] **Typed routes enabled** ← MISSING
- [ ] **Route nesting reduced** ← TOO DEEP

### Build & Deployment
- [x] EAS configured
- [x] Bundle IDs set (iOS + Android)
- [x] App scheme set
- [x] SQLCipher enabled
- [x] SecureStore plugin
- [ ] **Android permissions in app.json** ← MISSING CRITICAL
- [ ] **Environment vars in eas.json** ← MISSING CRITICAL
- [ ] **metro.config.js** ← MISSING CRITICAL
- [ ] **Organization EAS owner** ← Personal account

### Testing & Monitoring
- [ ] **Jest configured** ← NOT CONFIGURED
- [ ] **Test files exist** ← NONE FOUND
- [ ] **Sentry crash reporting** ← NOT INTEGRATED
- [ ] **Analytics** ← NOT INTEGRATED
- [ ] **OTA updates (expo-updates)** ← NOT CONFIGURED

---

## Part 9: Immediate Action Items

```
THIS WEEK (before any QA builds):
□ Create metro.config.js with monorepo workspace paths
□ Update eas.json with per-environment API URLs
□ Add Android permissions to app.json
□ Fix DB key deletion to run on all logout, not just shared devices

SPRINT 1 (before production):
□ Create app/+not-found.tsx
□ Rename useAuthGuard → useAuthContext to fix naming confusion
□ Remove (workspace) layout group (merge into protected)
□ Add AppState foreground revocation check
□ Set up ESLint + Prettier
□ Set up Jest + write tests for initialize-auth.ts + refresh-token-attempt.ts

SPRINT 2 (quality hardening):
□ Flatten route nesting from 6 levels to 3 levels
□ Enable typedRoutes in app.json experiments
□ Add SSL pin expiry monitoring
□ Remove Zustand if unused
□ Transfer EAS to organization account
□ Add Sentry integration
```

---

## Appendix A: File Count by Layer

| Layer | Files | Purpose |
|-------|-------|---------|
| `app/` (routes) | 20+ | Navigation, layouts, screens |
| `features/` | 30+ | UI screens and feature hooks |
| `lib/` | 26 | Core business logic, security |
| `store/` | 7 | Redux state management |
| `hooks/` | 4 | App-level React hooks |
| `services/` | 1 | Service handlers |
| `components/` | 5 | Shared UI components |
| `shared/` | 4 | Error types and utilities |

**Total:** ~97 TypeScript files — reasonable for a production POS app.

---

## Appendix B: Navigation Stack Depth Map

```
Current (TOO DEEP):
Root → (protected) → (workspace) → (app) → (personal) → (tabs) → dashboard
  6 layouts render for 1 screen

Recommended:
Root → (protected) → (personal) → dashboard
  3 layouts render for 1 screen
```

---

## Appendix C: Auth State Sources of Truth

| State | Source | Used By |
|-------|--------|---------|
| `isLoggedIn` | AuthContext (React Context) | Route guards in _layout.tsx |
| `isLoading` | AuthContext (React Context) | Route guards in _layout.tsx |
| `isInitializing` | Redux auth slice | Workspace layout (should be removed) |
| `isAuthenticated` | Redux auth slice | Deep app logic, API calls |
| `authResponse` | Redux auth slice | All feature components via useAuth() |

**Problem:** Two different hooks expose auth state with overlapping concerns. Consolidate.

---

*Document generated from live codebase analysis. All file paths verified.*
