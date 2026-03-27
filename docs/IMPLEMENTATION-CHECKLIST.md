# Mobile Auth Integration - Implementation Checklist

## ✅ Completed: API Integration

### Part A: Redux Thunk (Global Auth State)

- [x] **Auth DTOs** - `libs-common/api-manager/src/lib/auth/request-dto.ts`
  - ✅ SendOtpRequest / SendOtpResponse
  - ✅ VerifyOtpRequest
  - ✅ AuthResponse (consolidated response)
  - ✅ ProfileCompleteRequest / ProfileCompleteResponse
  - ✅ StoreSelectRequest

- [x] **API Endpoints** - `libs-common/api-manager/src/lib/auth/api-data.ts`
  - ✅ OTP_SEND (public)
  - ✅ OTP_VERIFY (public)
  - ✅ GET_SESSION (authenticated)
  - ✅ PROFILE_COMPLETE (authenticated)
  - ✅ STORE_SELECT (authenticated)

- [x] **Async Thunks** - `libs-common/api-manager/src/lib/auth/api-thunk.ts`
  - ✅ sendOtp thunk
  - ✅ verifyOtp thunk
  - ✅ getSession thunk
  - ✅ profileComplete thunk
  - ✅ storeSelect thunk

- [x] **Redux Slice** - `libs-common/state-manager/src/lib/shared-slice/auth/`
  - ✅ AuthState model with API states
  - ✅ slice.ts with all reducers and extra reducers
  - ✅ Proper action exports
  - ✅ Registered in base-reducer.ts

---

### Part B: TanStack Query (Store Listings)

- [x] **Store Types** - `libs-common/api-handler/src/lib/stores/types.ts`
  - ✅ StoreListParams interface
  - ✅ StoreListItem interface
  - ✅ StoreDetail interface
  - ✅ API response types

- [x] **Store Endpoints** - `libs-common/api-handler/src/lib/stores/api-data.ts`
  - ✅ STORE_ENDPOINTS constants
  - ✅ buildStoreUrl builder function

- [x] **Query Hooks** - `libs-common/api-handler/src/lib/stores/tanstack-queries.ts`
  - ✅ storeKeys query factory
  - ✅ useStores() list hook
  - ✅ useStore() detail hook
  - ✅ Proper caching strategy

- [x] **Module Exports** - `libs-common/api-handler/src/lib/stores/index.ts`
  - ✅ All types exported
  - ✅ All hooks exported

---

## 📱 To Implement: Mobile Components

### Phase 1: Authentication Screens

- [ ] **LoginScreen.tsx** (See `docs/mobile-components-example.md`)
  - Phone input with validation
  - OTP input with verification
  - Error handling with Alert
  - Redux dispatch for sendOtp/verifyOtp

- [ ] **ProfileCompletionScreen.tsx** (See `docs/mobile-components-example.md`)
  - Name input (required)
  - Email input (optional)
  - Password input (if email provided)
  - Redux dispatch for profileComplete
  - Routing to next step based on response

- [ ] **StoreSelectionScreen.tsx** (See `docs/mobile-components-example.md`)
  - List stores using useStores() hook
  - Store card selection UI
  - Redux dispatch for storeSelect
  - Navigate to StoreDashboard

### Phase 2: Navigation Setup

- [ ] **RootNavigator.tsx**
  - Stack navigator with screens
  - Conditional initial route based on auth state
  - Proper screen transitions

- [ ] **StoreDashboardNavigator.tsx** (placeholder)
  - Implement bottom tab navigator for main app

### Phase 3: App Root & Persistence

- [ ] **App.tsx**
  - Redux Provider setup
  - QueryClientProvider setup
  - Initialize auth on app launch
  - getSession call to restore auth state

- [ ] **tokenStorage.ts** (AsyncStorage utility)
  - Save token after successful login
  - Restore token on app launch
  - Clear token on logout

---

## 🔌 API Endpoints Needed

Ensure backend has these endpoints:

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/auth/otp/send` | POST | ❌ | ✅ Exists |
| `/auth/otp/verify` | POST | ❌ | ✅ Exists |
| `/auth/get-session` | GET | ✅ | ✅ Exists |
| `/auth/profile/complete` | POST | ✅ | ✅ Exists |
| `/auth/store/select` | POST | ✅ | ✅ Exists |
| `/stores` | GET | ✅ | ⚠️ Need to create |
| `/stores/{storeId}` | GET | ✅ | ⚠️ Need to create |

---

## 📋 Redux State Structure

```typescript
baseStore.auth = {
  // Auth status
  status: "AUTHENTICATED" | "UNAUTHENTICATED" | "INITIALIZING" | "LOCKED"

  // User data
  user: {
    user: { id, name, email, emailVerified, ... }
    token: "jwt_token"
    session: { token, expiresAt }
    access: {
      roles: [ { roleCode, storeId, storeName } ]
      permissions: [ "permission_code", ... ]
      isSuperAdmin: boolean
      activeStoreId: number | null
      userType: "SUPER_ADMIN" | "STAFF" | "PERSONAL" | ...
    }
  }

  // API states for async operations
  sendOtpState: { isLoading, hasError, response, errors }
  verifyOtpState: { isLoading, hasError, response, errors }
  profileCompleteState: { isLoading, hasError, response, errors }
  storeSelectState: { isLoading, hasError, response, errors }
}
```

---

## 🚀 Component Usage Examples

### Using Redux (OTP Login)

```typescript
const dispatch = useBaseStoreDispatch();
const { sendOtpState, verifyOtpState } = useBaseStoreSelector(
  state => state.auth
);

// Send OTP
await dispatch(sendOtp({ bodyParam: { phone } })).unwrap();

// Verify OTP
const authResponse = await dispatch(
  verifyOtp({ bodyParam: { phone, otp, reqId } })
).unwrap();
```

### Using TanStack Query (Store List)

```typescript
const { data, isLoading, error } = useStores({
  page: 1,
  pageSize: 20,
  search: "store name"
});

const stores = data?.items ?? [];
```

---

## 🔐 Security Checklist

- [ ] Never store password in localStorage/AsyncStorage
- [ ] Store only JWT token in storage
- [ ] Validate JWT expiry before using
- [ ] Clear storage on logout
- [ ] Use HTTPS for all API calls
- [ ] Implement certificate pinning (if needed)
- [ ] Rate limit OTP requests (backend: 5/24h)
- [ ] Validate password strength (12+ chars required)
- [ ] Enable CORS only for trusted domains

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] sendOtp thunk (success/error paths)
- [ ] verifyOtp thunk (success/error paths)
- [ ] profileComplete thunk (all nextStep paths)
- [ ] storeSelect thunk (success/error paths)
- [ ] useStores hook (loading/error/success states)
- [ ] tokenStorage utility (save/get/clear)

### Integration Tests

- [ ] Full OTP login flow
- [ ] Profile completion with email verification
- [ ] Store selection and navigation
- [ ] Token persistence across app restarts
- [ ] Error handling and retry logic

### Manual Testing

- [ ] LoginScreen UI and interactions
- [ ] ProfileCompletionScreen validation
- [ ] StoreSelectionScreen list rendering
- [ ] Navigation routing between screens
- [ ] Network error handling
- [ ] Timeout handling

---

## 📦 Dependencies to Install

```bash
# React Native / Expo
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install @react-native-async-storage/async-storage

# Redux & State Management (should already exist)
npm install redux @reduxjs/toolkit react-redux

# TanStack Query
npm install @tanstack/react-query

# API Client (should already exist)
npm install axios
```

---

## 📚 Documentation Files

1. **docs/auth-mobile-integration.md**
   - Complete step-by-step implementation guide
   - Follows API integration patterns
   - Code examples for all layers

2. **docs/auth-flow-summary.md**
   - Quick reference guide
   - Visual flow diagrams
   - Endpoint checklist
   - Error handling guide

3. **docs/mobile-components-example.md**
   - Complete React Native components
   - LoginScreen, ProfileCompletionScreen, StoreSelectionScreen
   - Navigation setup
   - App root setup
   - Token persistence utility

4. **docs/IMPLEMENTATION-CHECKLIST.md** (this file)
   - Tracking progress
   - Component breakdown
   - API endpoints status
   - Testing checklist

---

## ✨ Next Steps

1. **Install dependencies** (if not already installed)
2. **Create screens** using examples from `mobile-components-example.md`
3. **Setup navigation** with RootNavigator
4. **Test OTP flow** (send → verify)
5. **Test profile completion** (email+password setup)
6. **Test store selection** (list → select)
7. **Implement token persistence** (AsyncStorage)
8. **Run tests** (unit + integration)
9. **Manual testing** on device/simulator
10. **Deploy to staging** for QA testing

---

## 🎯 Success Criteria

- [ ] User can login with phone OTP
- [ ] OTP verification works (auto-creates user if new)
- [ ] Profile completion guides through setup
- [ ] Email verification (if email provided)
- [ ] Store selection works for users with access
- [ ] Redux state persists auth data correctly
- [ ] TanStack Query caches store list
- [ ] Navigation flows smoothly between screens
- [ ] Error handling shows user-friendly messages
- [ ] App restores auth state after cold start

