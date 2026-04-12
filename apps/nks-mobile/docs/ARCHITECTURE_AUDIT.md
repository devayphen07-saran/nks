# NKS Mobile App - Architecture Audit

**Assessment Date:** 2026-04-09
**Codebase Size:** 5,158 LOC
**Current Maturity:** Prototype → Early-Stage Product

---

## Executive Summary

The NKS mobile app has a **functional but fragile architecture**. It works today because the codebase is small, but it will become unmaintainable at scale. The main issues:

1. **Large, god-like screen components** (456+ lines) that handle UI + logic
2. **Scattered state management** mixing Redux, useState, hooks, and Context
3. **No service/business logic layer** — API calls directly from UI hooks
4. **Tight coupling** between screens, hooks, and API manager
5. **No dependency injection** — Hard-coded dependencies everywhere
6. **No clear separation of concerns** — UI, business logic, and data access mixed
7. **Error handling scattered** across multiple layers
8. **No data layer abstraction** — Direct API calls from everywhere

This document outlines the architectural problems and a migration path to enterprise-grade architecture.

---

## Part 1: Current Architecture Analysis

### 1.1 Folder Structure

```
apps/nks-mobile/
├── app/                    # Expo Router navigation
├── features/               # Feature-based folders
│   ├── auth/              # Screens + hooks + schemas
│   ├── store/
│   ├── personal/
│   └── user/
├── lib/                    # Infrastructure
│   ├── auth-provider.tsx   # Auth context
│   ├── axios-interceptors.ts
│   └── routes.ts           # Route constants
├── store/                  # Redux (global state)
│   ├── authSlice.ts
│   ├── index.ts
│   └── ...slices
└── hooks/                  # Global hooks
```

**Issues:**
- ❌ No clear feature structure — auth hooks live inside features, but store logic is global
- ❌ No service layer — business logic scattered across hooks
- ❌ No repository/data layer — API calls embedded in hooks
- ❌ No container components — screens directly contain logic
- ⚠️ Mixed patterns — some features use Redux, some use useState, some use Context

---

### 1.2 State Management Pattern

**Current (Problematic):**
```
Screen Component
    ├── useReduxAuth() — Redux hook for auth state
    ├── usePhoneAuth() — Custom hook for form state + API calls
    ├── useState() — Local UI state (loading, errors)
    ├── useLocalSearchParams() — Route params
    └── Styling + JSX
```

**Problems:**
1. **Mixed concerns** — usePhoneAuth handles form state + API calls + validation + routing
2. **No separation** — Can't test form validation without mocking API
3. **Tight coupling** — usePhoneAuth directly depends on Redux dispatch + router + API
4. **Hard to reuse** — usePhoneAuth is tightly coupled to PhoneScreen's UI
5. **No single source of truth** — Auth state in Redux, form state in useState, session state in SecureStore

---

### 1.3 Component Size & Complexity

**Current Component Sizes:**
```
OtpScreen.tsx               456 lines ❌❌❌
PhoneScreen.tsx             362 lines ❌❌
SetPasswordScreen.tsx       297 lines ❌
StoreListScreen.tsx         297 lines ❌
StoreSetupScreen.tsx        266 lines ❌
UserProfileScreen.tsx       283 lines ❌
```

**Ideal Component Sizes:**
- Presentation components: 100-150 lines max
- Container components: 100-200 lines max
- Complex screens: Break into 3-5 sub-components

**Example: OtpScreen current structure**
```tsx
OtpScreen (456 lines)
├── BrandHero (inline styled component) — 40 lines
├── OtpDigitCell (sub-component) — 30 lines
├── FormCard (inline styled component) — 70 lines
├── Logic (useOtpVerify hook calls) — 100 lines
├── Event handlers — 50 lines
└── 15 styled-components — 150+ lines
```

**Better structure:**
```tsx
OtpScreen (120 lines - presenter)
├── useOtpVerify (hook - logic)
└── Components:
    ├── OtpHeroSection (40 lines)
    ├── OtpInputField (60 lines)
    └── OtpFormCard (50 lines)
```

---

### 1.4 Data Flow & State Management

**Current Data Flow (Problematic):**
```
PhoneScreen.tsx
    ↓
usePhoneAuth.ts (custom hook)
    ├─→ dispatch(sendOtp) [Redux]
    ├─→ router.push() [Expo Router]
    ├─→ setErrorMessage() [useState]
    ├─→ API.post() [Axios]
    └─→ tokenManager.saveSession() [SecureStore]
```

**Problems:**
1. **No dependency injection** — Hard to test without mocking everything
2. **Multiple sources of truth** — Auth state scattered across Redux, SecureStore, tokenManager
3. **Side effects mixed with logic** — usePhoneAuth does API calls + routing + error handling
4. **No request/response types** — API responses not typed
5. **No error handling layer** — Errors propagate up to screens

**Better Data Flow (Layered Architecture):**
```
UI Layer (PhoneScreen)
    ↓ dispatch action
Services Layer (PhoneService)
    ├─→ Validates input
    ├─→ Calls Repository
    └─→ Updates Redux
    ↓
Repository Layer (PhoneRepository)
    ├─→ Calls API endpoint
    ├─→ Handles API errors
    └─→ Returns typed response
    ↓
API Layer (API Manager)
    ├─→ Axios instance
    ├─→ Interceptors
    └─→ Auth header injection
```

---

### 1.5 Error Handling Architecture

**Current (Scattered):**
```typescript
// Error handling in PhoneScreen
const handleSendOtp = () => {
  try {
    dispatch(sendOtp(...))
      .catch((err) => setErrorMessage(err?.message)) // UI layer
  } catch (error) {
    setErrorMessage(error) // Try-catch in component
  }
}

// Error handling in axios-interceptors
try {
  const response = await API.post() // API layer
} catch (err) {
  // Handle 401, 403, network errors
}

// Error handling in Redux slice
extraReducers: {
  [sendOtp.rejected]: (state, action) => {
    state.error = action.payload // Redux layer
  }
}
```

**Problems:**
- ❌ No centralized error handling
- ❌ Different error handling in different layers
- ❌ No error recovery strategy
- ❌ User-facing errors mixed with technical errors
- ❌ No error context capture

**Better Pattern (Centralized):**
```typescript
// Custom AppError class with type and context
class AppError extends Error {
  constructor(
    public code: string,           // 'NETWORK_ERROR', 'VALIDATION_ERROR', etc.
    public message: string,         // User-facing message
    public context?: Record<string, any>
  ) {}
}

// Error handler in services
async function sendOtp(phone: string) {
  try {
    const response = await phoneRepository.sendOtp(phone);
    return response;
  } catch (error) {
    throw new AppError(
      'OTP_SEND_FAILED',
      'Failed to send OTP. Please try again.',
      { phone, originalError: error }
    );
  }
}

// Error boundary in UI
catch (error: AppError) {
  if (error.code === 'NETWORK_ERROR') {
    showNetworkRetry();
  } else if (error.code === 'VALIDATION_ERROR') {
    showValidationMessage(error.message);
  }
}
```

---

### 1.6 Dependency Coupling Issues

**Example: PhoneScreen → usePhoneAuth → API**

```typescript
// PhoneScreen.tsx
import { usePhoneAuth } from './hooks/usePhoneAuth';
const phoneState = usePhoneAuth(); // Hard dependency

// hooks/usePhoneAuth.ts
import { useRootDispatch } from '../../../store';
import { sendOtp } from '@nks/api-manager';
import { router } from 'expo-router';

// Direct imports = tight coupling
// Can't test usePhoneAuth without:
// ✗ Redux store
// ✗ Router
// ✗ API manager
// ✗ All their dependencies
```

**Problems:**
- ❌ Can't test hooks in isolation
- ❌ Can't reuse hooks with different API clients
- ❌ Hard to mock dependencies
- ❌ Testing requires full app setup

---

## Part 2: Enterprise Architecture Design

### 2.1 Proposed Layered Architecture

```
┌─────────────────────────────────────────────────┐
│          UI Layer (Presentation)                │
│  Screens, Components, Forms, Navigation         │
└──────────────────────┬──────────────────────────┘
                       │ dispatch actions
┌──────────────────────▼──────────────────────────┐
│          View Model Layer (Hooks)               │
│  usePhoneAuth, useOtpVerify, useAuth            │
│  Pure logic, no side effects, testable          │
└──────────────────────┬──────────────────────────┘
                       │ calls services
┌──────────────────────▼──────────────────────────┐
│         Services Layer (Business Logic)         │
│  AuthService, PhoneService, StoreService        │
│  Orchestrates repositories & validation         │
└──────────────────────┬──────────────────────────┘
                       │ calls repositories
┌──────────────────────▼──────────────────────────┐
│       Repository Layer (Data Access)            │
│  PhoneRepository, OtpRepository                  │
│  API calls, error transformation, caching       │
└──────────────────────┬──────────────────────────┘
                       │ calls API client
┌──────────────────────▼──────────────────────────┐
│           API Layer (HTTP Client)               │
│  Axios instance, interceptors, auth headers     │
└─────────────────────────────────────────────────┘
```

**Data Flow with Layered Architecture:**
```
1. UI: User taps "Send OTP"
   ↓
2. Hook: usePhoneAuth calls handleSendOtp()
   ↓
3. Service: authService.sendOtp(phone)
   ↓
4. Repository: phoneRepository.sendOtp(phone)
   ↓
5. API: API.post('/auth/send-otp', { phone })
   ↓
6. Response flows back up: API → Repository → Service → Hook → UI
```

---

### 2.2 Feature Structure (Recommended)

```
features/auth/
├── screens/                    # Presentation layer
│   ├── PhoneScreen.tsx        # Pure presenter (120 lines)
│   ├── OtpScreen.tsx
│   └── SetPasswordScreen.tsx
├── hooks/                      # View model layer
│   ├── usePhoneAuth.ts        # Pure logic, testable
│   ├── useOtpVerify.ts
│   └── useSetPassword.ts
├── services/                   # Business logic layer
│   ├── authService.ts         # Orchestrates repositories
│   ├── phoneService.ts
│   └── otpService.ts
├── repositories/               # Data access layer
│   ├── phoneRepository.ts     # API calls
│   ├── otpRepository.ts
│   └── authRepository.ts
├── schemas/                    # Validation
│   ├── phone.ts
│   ├── otp.ts
│   └── password.ts
├── types/                      # Feature types
│   ├── auth.types.ts
│   └── requests.ts
├── constants/                  # Feature constants
│   └── auth.constants.ts
├── index.ts                    # Public API
└── tests/                      # Feature tests
    ├── services.test.ts
    ├── repositories.test.ts
    └── hooks.test.ts
```

**Key Principle:** Each feature is self-contained with clear layer boundaries.

---

### 2.3 Dependency Injection Pattern

**Problem: Hard Dependencies**
```typescript
// Current - tight coupling
export function usePhoneAuth() {
  const dispatch = useRootDispatch(); // Hard dependency on Redux
  const phoneService = new PhoneService(); // Hard dependency

  const handleSendOtp = async (phone) => {
    dispatch(sendOtp({ ... })); // Directly calls Redux
    router.push(...); // Directly calls router
  };
}
```

**Solution: Dependency Injection**
```typescript
// services/authService.ts
export class AuthService {
  constructor(
    private phoneRepository: IPhoneRepository,
    private authRepository: IAuthRepository,
    private tokenManager: ITokenManager,
  ) {}

  async sendOtp(phone: string): Promise<{ reqId: string }> {
    const response = await this.phoneRepository.sendOtp(phone);
    return response;
  }
}

// hooks/usePhoneAuth.ts
export function usePhoneAuth(
  authService: AuthService,
  router: ExpoRouter,
  dispatch: AppDispatch,
) {
  const [phone, setPhone] = useState('');

  const handleSendOtp = async () => {
    const { reqId } = await authService.sendOtp(phone);
    router.push({ pathname: '/(auth)/otp', params: { reqId } });
  };

  return { phone, setPhone, handleSendOtp };
}

// Instantiation (app root or factory)
const phoneRepository = new PhoneRepository(apiClient);
const authRepository = new AuthRepository(apiClient);
const tokenManager = new TokenManager();
const authService = new AuthService(
  phoneRepository,
  authRepository,
  tokenManager
);

// In PhoneScreen
const phoneState = usePhoneAuth(authService, router, dispatch);
```

**Benefits:**
- ✅ Easy to test — pass mock services
- ✅ Can swap implementations
- ✅ Clear dependencies
- ✅ No global state coupling

---

### 2.4 Component Decomposition Strategy

**Example: OtpScreen (456 lines) → Modular**

**Before (Monolithic):**
```tsx
export function OtpScreen() {
  const { digits, focusedIndex, countdown, ... } = useOtpVerify();

  return (
    <Container>
      <BrandHero>
        <DecoRing1 /><DecoRing2 /><DecoRing3 /><DecoRing4 />
        {/* 40 lines of brand section */}
      </BrandHero>
      <FormCard>
        <OtpBoxRow>
          {/* 30 lines of OTP input field loop */}
        </OtpBoxRow>
        {/* 20 lines error banner */}
        {/* 25 lines resend section */}
        {/* 15 lines verify button */}
      </FormCard>
      {/* 150 lines of styled-components */}
    </Container>
  );
}
```

**After (Composable):**
```tsx
// screens/OtpScreen.tsx (120 lines)
export function OtpScreen() {
  const otpState = useOtpVerify();

  return (
    <OtpScreenContainer>
      <BrandHeroSection phone={otpState.phone} />
      <OtpFormSection otpState={otpState} />
    </OtpScreenContainer>
  );
}

// components/BrandHeroSection.tsx (40 lines)
export function BrandHeroSection({ phone }) {
  return (
    <BrandHero>
      <DecoRings />
      <HeroText phone={maskPhone(phone)} />
    </BrandHero>
  );
}

// components/OtpFormSection.tsx (50 lines)
export function OtpFormSection({ otpState }) {
  return (
    <FormCard>
      <OtpInputField digits={otpState.digits} onchange={...} />
      {otpState.errorMessage && <ErrorBanner msg={...} />}
      <ResendSection countdown={otpState.countdown} onResend={...} />
      <VerifyButton onPress={...} loading={...} />
    </FormCard>
  );
}

// components/OtpInputField.tsx (60 lines)
export function OtpInputField({ digits, onChange }) {
  return (
    <OtpBoxRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <OtpBox key={i}>
          <OtpDigitCell value={digits[i]} onChange={...} />
        </OtpBox>
      ))}
    </OtpBoxRow>
  );
}

// styles/otp.styles.ts (50 lines)
// All styled components in one file for easy maintenance
```

**Benefits:**
- ✅ Each component 40-60 lines max
- ✅ Reusable OtpInputField in other features
- ✅ Easy to test each component
- ✅ Easy to style consistently

---

### 2.5 State Management Clarification

**Clear Rules:**

| State Type | Storage | Tool | Purpose |
|-----------|---------|------|---------|
| **Authentication** | Redux | Redux Slice | User logged in, session, permissions |
| **Server Data** | Redux | Redux + TanStack Query | Countries, stores, user profile |
| **Form State** | Component | useState | Phone input, password fields |
| **UI State** | Component | useState | Loading, errors, visibility toggles |
| **Navigation** | Transient | Expo Router | Routes, deeplinks |
| **Session Token** | SecureStore | tokenManager | JWT, refresh token, expiry |

**Examples:**

```typescript
// ✅ In Redux - global app state
const authSlice = createSlice({
  initialState: {
    isAuthenticated: false,
    user: null,
    permissions: [],
  }
});

// ✅ In useState - form state
const [phone, setPhone] = useState('');
const [password, setPassword] = useState('');

// ✅ In TanStack Query - reference data
const { data: countries } = useQuery(GET_COUNTRIES.queryOptions());

// ✅ In tokenManager/SecureStore - sensitive data
await tokenManager.saveSession({ sessionToken, refreshToken });

// ❌ Avoid: Form state in Redux
// ❌ Avoid: Server data in useState
// ❌ Avoid: Sensitive data in Redux
```

---

### 2.6 Error Handling Architecture

**Centralized Error Handling:**

```typescript
// shared/errors/AppError.ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode?: number,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

// shared/errors/ErrorHandler.ts
export class ErrorHandler {
  static handle(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 400) {
        return new AppError(
          'VALIDATION_ERROR',
          data?.message || 'Invalid input',
          400,
          { field: data?.field }
        );
      }
      if (status === 401) {
        return new AppError('AUTH_ERROR', 'Session expired', 401);
      }
      if (status === 404) {
        return new AppError('NOT_FOUND', 'Resource not found', 404);
      }
      if (status >= 500) {
        return new AppError('SERVER_ERROR', 'Server error', status);
      }
      return new AppError(
        'NETWORK_ERROR',
        'Network request failed',
        status,
        { originalError: error.message }
      );
    }

    return new AppError('UNKNOWN_ERROR', 'An unexpected error occurred');
  }
}

// In repositories
export class PhoneRepository {
  async sendOtp(phone: string) {
    try {
      const response = await api.post('/auth/send-otp', { phone });
      return response.data;
    } catch (error) {
      throw ErrorHandler.handle(error);
    }
  }
}

// In services
export class PhoneService {
  async sendOtp(phone: string) {
    try {
      return await this.phoneRepository.sendOtp(phone);
    } catch (error: AppError) {
      logger.error('OTP send failed', { phone, error });
      throw error; // Re-throw for UI to handle
    }
  }
}

// In hooks
export function usePhoneAuth() {
  const handleSendOtp = async () => {
    try {
      const result = await phoneService.sendOtp(phone);
      router.push(...);
    } catch (error: AppError) {
      if (error.code === 'VALIDATION_ERROR') {
        setErrorMessage('Please enter a valid phone number');
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('Network error. Please check your connection.');
      } else {
        setErrorMessage(error.message);
      }
    }
  };
}
```

---

### 2.7 API Client & Interceptors

**Current: Interceptors handle everything**
```typescript
// axios-interceptors.ts handles:
// - Token injection
// - Token refresh
// - Error handling
// - Retry logic
// - All mixed together
```

**Better: Layered approach**

```typescript
// api/client.ts
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// api/interceptors/auth.interceptor.ts
export function setupAuthInterceptor(apiClient: AxiosInstance) {
  apiClient.interceptors.request.use((config) => {
    const token = tokenManager.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

// api/interceptors/error.interceptor.ts
export function setupErrorInterceptor(apiClient: AxiosInstance) {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Handle token refresh
        const newToken = await tokenManager.refresh();
        if (newToken) {
          return apiClient.request(error.config);
        }
      }
      throw ErrorHandler.handle(error);
    }
  );
}

// api/interceptors/index.ts
export function setupApiInterceptors() {
  setupAuthInterceptor(apiClient);
  setupErrorInterceptor(apiClient);
  setupLoggingInterceptor(apiClient);
}
```

---

## Part 3: Migration Strategy

### Phase 1: Foundation (Week 1-2)

**Goal:** Establish layered architecture foundation

1. Create folder structure for services, repositories, types
2. Extract business logic from hooks into services
3. Extract API calls into repositories
4. Create shared error handling
5. Set up dependency injection container

**Files to Create:**
```
features/auth/
├── services/authService.ts (new)
├── repositories/phoneRepository.ts (new)
├── types/auth.types.ts (new)
└── errors/ (new)
```

**Example Migration:**

```typescript
// Before: usePhoneAuth.ts (API call in hook)
export function usePhoneAuth() {
  const dispatch = useRootDispatch();
  const handleSendOtp = async () => {
    dispatch(sendOtp({ bodyParam: { phone } })) // API call here
  };
}

// After Phase 1: Separate concerns
// features/auth/repositories/phoneRepository.ts (new)
export class PhoneRepository {
  constructor(private apiClient: AxiosInstance) {}
  async sendOtp(phone: string) {
    const response = await this.apiClient.post('/auth/send-otp', { phone });
    return response.data;
  }
}

// features/auth/services/authService.ts (new)
export class AuthService {
  constructor(
    private phoneRepository: PhoneRepository,
    private dispatch: AppDispatch,
  ) {}
  async sendOtp(phone: string) {
    const result = await this.phoneRepository.sendOtp(phone);
    this.dispatch(setOtpState(result));
    return result;
  }
}

// features/auth/hooks/usePhoneAuth.ts (refactored)
export function usePhoneAuth(authService: AuthService) {
  const [phone, setPhone] = useState('');
  const handleSendOtp = async () => {
    await authService.sendOtp(phone); // Calls service, not API
  };
  return { phone, setPhone, handleSendOtp };
}
```

---

### Phase 2: Component Refactoring (Week 3-4)

**Goal:** Decompose large screens into smaller components

1. Extract sub-components from screens (target: 100-150 lines per component)
2. Move styled components to separate files
3. Create component composition patterns
4. Document component APIs

**Example:**

```typescript
// Before: 456 lines
// OtpScreen.tsx

// After: Modular structure
// screens/OtpScreen.tsx (120 lines)
// components/OtpHeroSection.tsx (40 lines)
// components/OtpFormSection.tsx (50 lines)
// components/OtpInputField.tsx (60 lines)
// styles/otp.styles.ts (50 lines)
```

---

### Phase 3: Testing Foundation (Week 5)

**Goal:** Set up testing infrastructure and add critical path tests

1. Set up Jest + React Testing Library
2. Add unit tests for services (30-40 tests)
3. Add unit tests for repositories (20-30 tests)
4. Add hook tests (10-15 tests)
5. Set up test coverage reporting

---

### Phase 4: State Management Cleanup (Week 6)

**Goal:** Clear rules for what goes where

1. Audit all state — move to correct location
2. Remove Redux state that should be useState
3. Add TanStack Query for reference data
4. Document state management rules

---

### Phase 5: Type Safety & Validation (Week 7)

**Goal:** Strong typing throughout

1. Create strict types for all API responses
2. Add request/response validation
3. Enable strict TypeScript settings
4. Type all Redux slices

---

## Part 4: Specific Issues & Solutions

### Issue 1: Monolithic Screens (456+ lines)

**Problem:** OtpScreen has everything mixed together

**Solution:**
```
OtpScreen.tsx (120 lines)
├── useOtpVerify (hook)
├── BrandHeroSection (component)
├── OtpFormSection (component)
└── OtpInputField (component)

Result: Each file 40-60 lines, reusable
```

**Effort:** 4 hours per large screen (8 screens × 4h = 32h)

---

### Issue 2: Hooks Doing Too Much

**Problem:** usePhoneAuth does: validation + API calls + routing + error handling

**Solution:**
```
usePhoneAuth (hook - pure logic only)
  ↓
PhoneService (business logic)
  ↓
PhoneRepository (API calls)
  ↓
ErrorHandler (error transformation)

Result: Each layer has single responsibility
```

**Effort:** 20 hours for all auth hooks

---

### Issue 3: No Service Layer

**Problem:** No orchestration between repositories and UI

**Solution:** Create services that orchestrate repositories
```typescript
class AuthService {
  async sendOtp(phone) {
    // Validate phone
    // Call repository
    // Update Redux
    // Log telemetry
    // Handle errors
  }
}
```

**Effort:** 16 hours to create all services

---

### Issue 4: Tight Coupling

**Problem:** Can't test hooks without full app setup

**Solution:** Dependency injection
```typescript
function usePhoneAuth(
  authService: AuthService,    // Injected
  router: Router,               // Injected
  dispatch: AppDispatch,        // Injected
) {
  // Pure logic, easy to test
}
```

**Effort:** 12 hours to refactor all hooks

---

### Issue 5: No Error Boundaries

**Problem:** Errors crash the app or show generic messages

**Solution:** Component error boundaries
```typescript
export function ErrorBoundary({ children }) {
  const [error, setError] = useState<AppError | null>(null);

  if (error?.code === 'AUTH_ERROR') return <LoginPrompt />;
  if (error?.code === 'NETWORK_ERROR') return <OfflineScreen />;
  if (error) return <ErrorScreen error={error} />;

  return children;
}
```

**Effort:** 8 hours

---

## Part 5: Quality Metrics

### Current State:
```
Component Size:        456 max lines (❌ should be <150)
Test Coverage:         0% (❌ should be >60%)
Type Coverage:         ~70% (⚠️ should be >95%)
Cyclomatic Complexity: High (❌ should be <10 per function)
Dependency Depth:      4+ layers ❌ (should be 2-3)
Error Handling:        Scattered (❌ should be centralized)
```

### Target State (Enterprise):
```
Component Size:        <120 lines (✅)
Test Coverage:         >70% (✅)
Type Coverage:         >95% (✅)
Cyclomatic Complexity: <8 per function (✅)
Dependency Depth:      2-3 layers (✅)
Error Handling:        Centralized with AppError (✅)
```

---

## Part 6: Implementation Checklist

### Phase 1: Foundation (11 Hours)
- [ ] Create feature folder structure (services, repositories, types)
- [ ] Create AppError class and ErrorHandler
- [ ] Create PhoneRepository (extract from hook)
- [ ] Create AuthService (orchestrate repositories)
- [ ] Set up dependency injection container
- [ ] Create shared types for auth domain

### Phase 2: Component Refactoring (32 Hours)
- [ ] Decompose OtpScreen (456 → 120 + 4 components)
- [ ] Decompose PhoneScreen (362 → 120 + 3 components)
- [ ] Decompose SetPasswordScreen (297 → 120 + 2 components)
- [ ] Decompose StoreSetupScreen (266 → 120 + 3 components)
- [ ] Extract all styled-components to separate files
- [ ] Create reusable component library

### Phase 3: Hook Refactoring (20 Hours)
- [ ] Refactor usePhoneAuth (remove API calls)
- [ ] Refactor useOtpVerify (remove API calls)
- [ ] Refactor useSetPassword (remove API calls)
- [ ] Refactor all hooks to be pure logic
- [ ] Add hook unit tests

### Phase 4: State Management (16 Hours)
- [ ] Audit all state usage
- [ ] Create clear state guidelines
- [ ] Move state to correct locations (Redux vs useState vs Query)
- [ ] Set up TanStack Query for reference data
- [ ] Document state management architecture

### Phase 5: Testing (30 Hours)
- [ ] Set up Jest + React Testing Library
- [ ] Write service unit tests (30 tests)
- [ ] Write repository unit tests (20 tests)
- [ ] Write hook unit tests (15 tests)
- [ ] Set up CI test execution
- [ ] Aim for >60% coverage

### Phase 6: Documentation (10 Hours)
- [ ] Architecture Decision Records (ADRs)
- [ ] API integration guide
- [ ] State management guide
- [ ] Error handling guide
- [ ] Component API documentation

**Total Effort: ~119 hours (3 weeks at 40h/week)**

---

## Summary: Architecture Maturity Roadmap

| Maturity Level | Status | Effort | Timeline |
|---|---|---|---|
| **Prototype** (current) | Functional but fragile | - | Complete |
| **Early-Stage** (Phase 1-2) | Layered, decomposed | 43h | 2 weeks |
| **Production-Ready** (Phase 3-4) | Tested, typed, maintainable | 36h | 1 week |
| **Enterprise-Grade** (Phase 5-6) | Documented, scalable, resilient | 40h | 1 week |

---

## Recommendation

**Start with Phase 1-2 immediately:**
- Establish clean architecture foundation
- Make components reusable and testable
- Set up dependency injection

**This unblocks:**
- Parallel feature development
- Easier testing
- Code reuse across features
- Onboarding new developers
