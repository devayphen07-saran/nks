# 🔍 NKS Web App - Complete Audit & Tasks

**Date:** April 1, 2026
**Status:** 🚨 Multiple Issues & Improvements Needed
**Priority:** High

---

## 📋 Executive Summary

The web app has **good structure** but needs **critical security updates** and **feature implementations** to match recent backend/mobile changes. Found:
- 🔴 **4 Critical Issues** (Security & Auth)
- 🟡 **7 Medium Issues** (Missing features, outdated code)
- 🟢 **5 Low Issues** (Improvements, cleanup)

**Estimated Effort:** 2-3 days for full completion

---

## 🔴 CRITICAL ISSUES

### 1. **Hardcoded localStorage Token Storage (SECURITY BUG)**

**File:** `src/app/(auth)/register/page.tsx` (Line 19, 79+)
**Issue:** Using `setAccessToken()` which stores tokens in localStorage
**Risk:** XSS vulnerability - tokens can be stolen by malicious scripts

**Current Code:**
```typescript
import { setAccessToken, setIamUserIdToken, setSessionId } from "@libs-web/web-utils/auth-storage";

// Later...
setAccessToken(accessToken); // ❌ INSECURE - localStorage!
```

**What Should Happen:**
```typescript
// ✅ Use httpOnly cookies (automatic with credentials: 'include')
// No token storage needed on client!
// Backend sets cookie, browser sends it automatically
```

**Action Required:**
- [ ] Remove localStorage token storage logic
- [ ] Remove `setAccessToken`, `setIamUserIdToken`, `setSessionId` calls
- [ ] API client already has `credentials: 'include'` (good!)
- [ ] Just redirect after successful auth

---

### 2. **API Client Missing CSRF Token**

**File:** `src/lib/api-client.ts` (Line 33-35)
**Issue:** Not sending CSRF token with mutations (POST, PUT, DELETE, PATCH)
**Risk:** CSRF attacks possible on state-changing operations

**Current Code:**
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...options.headers,
};
// ❌ Missing CSRF token!
```

**What Should Happen:**
```typescript
// For POST, PUT, DELETE, PATCH:
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...options.headers,
};

// Add CSRF token for mutations
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
  headers['X-CSRF-Token'] = getCsrfToken(); // Get from cookie
}
```

**Action Required:**
- [ ] Read CSRF token from cookie
- [ ] Add `X-CSRF-Token` header for mutations
- [ ] Keep GET requests unchanged

---

### 3. **Direct fetch() Instead of API Client**

**File:** `src/app/(auth)/setup/page.tsx` (Line 38)
**Issue:** Using direct `fetch()` instead of centralized `apiClient`
**Risk:** Inconsistent error handling, missing CSRF tokens, bypasses security setup

**Current Code:**
```typescript
const res = await fetch("/api/auth/setup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, password }),
});
```

**What Should Happen:**
```typescript
import { apiClient } from "@/lib/api-client";

const response = await apiClient.post("/auth/setup", {
  name, email, password
});
```

**Action Required:**
- [ ] Replace direct fetch with `apiClient`
- [ ] Review all pages for direct `fetch()` usage
- [ ] Use consistent error handling

---

### 4. **Missing Phone/OTP Authentication**

**File:** N/A - Feature not implemented
**Issue:** Web app doesn't have phone number login (mobile has it)
**Impact:** Users can't register via phone on web

**Backend Support:** ✅ Ready (`/auth/otp/send`, `/auth/otp/verify`)
**Mobile Support:** ✅ Ready (PhoneScreen)
**Web Support:** ❌ Missing

**Action Required:**
- [ ] Create OTP login page similar to mobile PhoneScreen
- [ ] Fetch countries from `/lookups/public/dial-codes`
- [ ] Send OTP via `/auth/otp/send`
- [ ] Verify OTP via `/auth/otp/verify`

---

## 🟡 MEDIUM ISSUES

### 5. **Not Using New Individual Lookup APIs**

**Files:** Register/Setup pages, any form that needs lookups
**Issue:** Hardcoded data instead of fetching from new `/lookups/*` endpoints
**Status:** New endpoints available, not integrated

**What's Missing:**
```typescript
// ❌ Current: Hardcoded list
const legalTypes = ["Pvt Ltd", "Sole Proprietor", ...];

// ✅ Should Use:
import { getLegalTypes, getStoreCategories, getSalutations } from "@nks/api-manager";

const result = await dispatch(getLegalTypes({}));
const types = result.payload?.data;
```

**Action Required:**
- [ ] Check all form pages (register, setup, store-creation)
- [ ] Replace hardcoded lookups with API calls
- [ ] Use new api-manager thunks: `getPublicCountries`, `getLegalTypes`, etc.

---

### 6. **Multi-Country Support Not Implemented**

**Files:** Register page, any country/address fields
**Issue:** No country selection, hardcoded to India
**Status:** Backend ✅, Mobile ✅, Web ❌

**What Needs to be Done:**
```typescript
// ❌ Current: Fixed to India
const country = "India";

// ✅ Should Be:
const countries = await dispatch(getPublicCountries({}));
// Let user select from list of active countries
```

**Action Required:**
- [ ] Add country selector to registration
- [ ] Add country field to address forms
- [ ] Update store registration for multi-country
- [ ] Use dynamic dial codes based on selected country

---

### 7. **No Cookie/CSRF Token Display/Management UI**

**Files:** Dashboard, Settings, Security page
**Issue:** User can't see or manage auth tokens/cookies
**Impact:** No visibility into security state

**Action Required:**
- [ ] Create security settings page showing:
  - [ ] Active sessions
  - [ ] Last login time
  - [ ] Device/browser info
  - [ ] Logout all option
- [ ] Show CSRF token status
- [ ] Show httpOnly cookie indicator

---

### 8. **API Base URL Configuration Issue**

**File:** `src/lib/api-client.ts` (Line 6)
**Issue:** Uses `NEXT_PUBLIC_API_URL` but `.env.local` uses `NEXT_PUBLIC_API_BASE_URL`
**Problem:** Mismatch causes 404 errors

**Current Code:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
// But .env.local has:
// NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

**Action Required:**
- [ ] Fix env var name to match `.env.local`
- [ ] Or update `.env.local` to match code
- [ ] Update `.env.example` for clarity

---

### 9. **Missing Environment File Template**

**File:** `.env.example` (doesn't exist)
**Issue:** New developers don't know what env vars to set
**Impact:** Setup errors, missing features

**Action Required:**
- [ ] Create `.env.example`:
```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1

# Auth Configuration
NEXT_PUBLIC_AUTH_URL=http://localhost:3000/login

# Google OAuth (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=
```

---

### 10. **No Request/Response Logging**

**Files:** `src/lib/api-client.ts`
**Issue:** Hard to debug API issues without request logging
**Impact:** Debugging production issues is slow

**Action Required:**
- [ ] Add request logging (method, endpoint, status)
- [ ] Add response logging (success/error, duration)
- [ ] Make it production-safe (don't log sensitive data)

---

### 11. **Missing Error Boundary & Error Handling**

**Files:** Protected pages, API-dependent components
**Issue:** No consistent error UI when APIs fail
**Impact:** Bad user experience on network errors

**Action Required:**
- [ ] Create reusable error component
- [ ] Add error boundaries to main sections
- [ ] Show user-friendly error messages
- [ ] Add retry buttons where appropriate

---

## 🟢 LOW PRIORITY IMPROVEMENTS

### 12. **Type Definitions Could Be Better**

**File:** `src/lib/api-client.ts` (Line 8-17)
**Issue:** `ApiResponse` type is generic but not exported for reuse

**Action Required:**
- [ ] Export `ApiResponse<T>` type
- [ ] Create types file with common response types
- [ ] Use throughout application

---

### 13. **No Loading States on Forms**

**Files:** Register, Setup pages
**Status:** Partially implemented
**Action Required:**
- [ ] Add loading state to all buttons
- [ ] Disable form during submission
- [ ] Show loading spinner or skeleton

---

### 14. **Inconsistent Error Messages**

**Files:** Various pages
**Issue:** Error messages in different format/style
**Action Required:**
- [ ] Create error message formatter
- [ ] Standardize error display
- [ ] Show helpful recovery steps

---

### 15. **No Input Validation**

**Files:** Register, Setup pages
**Issue:** Form validation is basic (only required field check)
**Action Required:**
- [ ] Add email validation
- [ ] Add password strength requirements
- [ ] Add phone number validation (when OTP added)
- [ ] Real-time feedback to user

---

### 16. **Missing Responsive Design for Mobile Web**

**Files:** All pages
**Issue:** Not optimized for mobile browsers
**Action Required:**
- [ ] Test on mobile devices
- [ ] Adjust breakpoints
- [ ] Optimize font sizes
- [ ] Ensure touch-friendly buttons

---

## 📊 Task Priority Matrix

| Issue | Priority | Effort | Impact | Notes |
|-------|----------|--------|--------|-------|
| localStorage tokens | 🔴 Critical | 2h | High | Security risk |
| CSRF token missing | 🔴 Critical | 3h | High | CSRF attacks possible |
| Direct fetch() | 🔴 Critical | 4h | High | Inconsistent error handling |
| Phone/OTP auth | 🟡 High | 8h | Medium | Feature parity with mobile |
| Multi-country support | 🟡 High | 6h | Medium | New feature |
| Lookup APIs | 🟡 High | 4h | Medium | Data freshness |
| Environment setup | 🟡 High | 1h | Medium | Onboarding blocker |
| API logging | 🟢 Low | 2h | Low | Nice to have |
| Error handling | 🟢 Low | 3h | Low | UX improvement |

---

## ✅ TASK CHECKLIST

### Phase 1: Critical Security (Day 1)

- [ ] Remove localStorage token storage
- [ ] Add CSRF token to API client
- [ ] Replace direct fetch() with apiClient
- [ ] Create `.env.example`
- [ ] Test all auth flows

**Estimated Time:** 6-8 hours

### Phase 2: Feature Parity (Day 2)

- [ ] Implement phone/OTP authentication
- [ ] Add multi-country support
- [ ] Integrate new lookup APIs
- [ ] Create security settings page

**Estimated Time:** 8-10 hours

### Phase 3: Polish (Day 3)

- [ ] Add error boundaries
- [ ] Implement request logging
- [ ] Improve form validation
- [ ] Mobile responsiveness
- [ ] Testing & bug fixes

**Estimated Time:** 6-8 hours

---

## 🔧 SETUP INSTRUCTIONS

### Local Development Setup

```bash
# 1. Install dependencies
cd apps/nks-web
npm install

# 2. Create .env.local (use template below)
cat > .env.local << 'EOF'
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_AUTH_URL=http://localhost:3000/login

# Optional: Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=
EOF

# 3. Start development server
npm run dev

# App will be at: http://localhost:3000
```

### Environment Variables Needed

```bash
# REQUIRED
NEXT_PUBLIC_API_BASE_URL      # Backend API URL
NEXT_PUBLIC_AUTH_URL          # Login page URL (for redirects)

# OPTIONAL
NEXT_PUBLIC_GOOGLE_CLIENT_ID  # For OAuth
NEXT_PUBLIC_ANALYTICS_ID      # For analytics
```

---

## 🚀 Implementation Order

**Recommended order to minimize blockers:**

1. ✅ Fix API client (CSRF token, env vars)
2. ✅ Remove localStorage token storage
3. ✅ Replace direct fetch() calls
4. ✅ Create `.env.example`
5. ✅ Integrate new lookup APIs
6. ✅ Add phone/OTP authentication
7. ✅ Add multi-country support
8. ✅ Polish & improvements

---

## 📝 File Checklist

### Files to Update

```
src/lib/api-client.ts               [CRITICAL] Add CSRF token, fix env var
src/app/(auth)/register/page.tsx    [CRITICAL] Remove localStorage
src/app/(auth)/setup/page.tsx       [CRITICAL] Use apiClient
src/app/(auth)/login/page.tsx       [New] Create phone/OTP auth
src/app/(protected)/settings/page.tsx [New] Create security page
.env.example                         [New] Create template
src/config/routes.ts                [Update] Add new routes
src/types/api.ts                    [New] Export types
```

### Files to Create

```
src/app/(auth)/otp/page.tsx         [New] OTP verification
src/app/(auth)/phone/page.tsx       [New] Phone login
src/components/CountrySelect.tsx    [New] Country selector
src/components/ErrorBoundary.tsx    [New] Error handling
src/components/FormLoader.tsx       [New] Loading state
src/hooks/useCountries.ts           [New] Countries fetch hook
src/hooks/useLookups.ts             [New] Lookups fetch hook
```

---

## 🧪 Testing Checklist

### Security Tests

- [ ] Tokens not in localStorage
- [ ] CSRF token sent on mutations
- [ ] Cookies set with httpOnly flag
- [ ] SameSite=Strict working

### Feature Tests

- [ ] Email registration works
- [ ] Phone/OTP registration works
- [ ] Store creation with multi-country
- [ ] Lookups load dynamically

### Integration Tests

- [ ] Register → Setup → Dashboard flow
- [ ] Auth errors handled gracefully
- [ ] Network errors show retry option
- [ ] Logout clears all state

---

## 📞 Support & Questions

### Common Questions

**Q: Why remove localStorage?**
A: httpOnly cookies are secure - JavaScript can't access them (no XSS risk)

**Q: What about CSRF tokens on GET requests?**
A: GET requests are read-only, CSRF only affects state-changing operations (POST, PUT, DELETE, PATCH)

**Q: Do I need to handle token refresh on web?**
A: No, backend handles it with refresh tokens in cookies automatically

**Q: Can I use the web app before all tasks are done?**
A: Yes, but security issues should be fixed first (Phase 1)

---

## Sign-Off

**Audit Completed:** April 1, 2026
**Total Issues Found:** 16 (4 critical, 7 medium, 5 low)
**Estimated Effort:** 2-3 days
**Current Status:** 🚨 **ISSUES NEED ATTENTION**

---

**Critical Path (Minimum to ship):**
1. Fix API client + CSRF
2. Remove localStorage
3. Fix env vars
4. Test auth flow
5. Deploy

**Full Feature Parity:**
6. Add phone/OTP auth
7. Add multi-country
8. Integrate new lookups
9. Polish & testing

