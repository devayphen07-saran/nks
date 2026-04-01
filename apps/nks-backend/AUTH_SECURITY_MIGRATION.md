# 🔐 Auth Security Migration Guide - httpOnly Cookies & CSRF

## Overview

This document covers the security improvements made to the authentication system:

1. **httpOnly Cookies** - Replaced localStorage for token storage (XSS protection)
2. **CSRF Protection** - Added CSRF token validation for state-changing requests
3. **Content Security Policy (CSP)** - Prevents XSS and other injection attacks
4. **Secure Cookie Configuration** - SameSite, Secure, HttpOnly flags

---

## What Changed

### Before (Vulnerable)
```javascript
// Frontend: Vulnerable - any JS can read this
localStorage.setItem('accessToken', token);

// Frontend: Token manually added to headers
headers['Authorization'] = `Bearer ${token}`;
```

**Risk:** XSS attack → attacker reads localStorage → steals token → full account takeover

### After (Secure)
```typescript
// Backend: Sets httpOnly cookie (JS cannot access)
res.cookie('nks_session', token, {
  httpOnly: true,    // ✅ JS cannot read
  secure: true,      // ✅ HTTPS only (production)
  sameSite: 'strict', // ✅ CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});

// Frontend: Cookies sent automatically
const response = await fetch(url, {
  credentials: 'include', // ✅ Include cookies automatically
});
```

**Protection:** Even if XSS attack injects JS, cookies are inaccessible (httpOnly flag)

---

## 🔧 Implementation Details

### 1. Backend Cookie Setup

**File:** `apps/nks-backend/src/modules/auth/controllers/auth.controller.ts`

After login/register/refresh endpoints, the backend automatically sets httpOnly cookies:

```typescript
// Automatically sets: Set-Cookie: nks_session=<token>; HttpOnly; Secure; SameSite=Strict
private setSessionCookie(res: Response, token: string): void {
  res.cookie('nks_session', token, {
    httpOnly: true,      // JavaScript cannot access
    sameSite: 'strict',  // Prevents CSRF
    secure: process.env['NODE_ENV'] === 'production', // HTTPS only
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}
```

**Cookie Expiry:**
- Development: HTTP cookies (secure: false)
- Production: HTTPS only (secure: true)

### 2. Frontend Cookie Usage

**File:** `apps/nks-web/src/lib/api-client.ts`

The frontend no longer reads/writes localStorage. Instead, cookies are sent automatically:

```typescript
// ✅ NEW: Frontend no longer touches localStorage
const response = await fetch(url, {
  ...options,
  headers,
  credentials: 'include', // ✅ Automatically include cookies
});
```

The `credentials: 'include'` flag tells the browser to:
1. Include httpOnly cookies in requests
2. Include cookies from cross-domain requests
3. Update cookies from response Set-Cookie headers

### 3. CSRF Protection

**File:** `apps/nks-backend/src/common/middleware/csrf.middleware.ts`

The CSRF middleware:

1. **Generates CSRF tokens** on first request
2. **Stores in cookie** (accessible to JS for reading via `document.cookie`)
3. **Validates tokens** on POST/PUT/DELETE/PATCH requests
4. **Exempts login/register** endpoints

**Frontend Integration:**

The frontend must send CSRF token in request headers:

```typescript
// Read CSRF token from cookie or response header
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1] || response.headers.get('X-CSRF-Token');

// Send in header for state-changing requests
fetch('/api/v1/users', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include',
});
```

### 4. Content Security Policy (CSP)

**File:** `apps/nks-backend/src/main.ts`

The backend sends CSP headers to restrict script execution:

```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],        // Only allow from same origin
      scriptSrc: ["'self'"],         // Only execute scripts from same origin
      styleSrc: ["'self'"],          // Only load styles from same origin
      imgSrc: ["'self'", 'https:'],  // Allow HTTPS images
      connectSrc: ["'self'"],        // Only connect to same origin
      frameSrc: ["'none'"],          // Prevent framing (clickjacking)
    },
  },
});
```

**What this prevents:**
- ✅ Inline scripts (`<script>alert('xss')</script>`)
- ✅ Event handlers (`onclick="alert('xss')"`)
- ✅ `eval()` and similar
- ✅ External scripts from malicious sites
- ✅ Framing attacks (clickjacking)

---

## 🚀 Migration Checklist

### Backend Changes
- [x] AuthController sets httpOnly cookies
- [x] CsrfMiddleware validates tokens
- [x] Helmet with CSP headers configured
- [x] CORS allows credentials: include
- [x] Cookie expiry set correctly

### Frontend Changes
- [x] ApiClient.request() uses `credentials: 'include'`
- [x] localStorage access removed
- [x] CSRF token handling implemented
- [x] Fetch calls include X-CSRF-Token header

### Testing
- [ ] Login sets httpOnly cookie
- [ ] Cookie sent automatically on next request
- [ ] localStorage no longer used
- [ ] CSRF token validated
- [ ] CSP headers present
- [ ] XSS attack blocked

---

## 🧪 Testing

### Test 1: Verify httpOnly Cookie

**Dev Tools → Application → Cookies**

After login, you should see:
```
Cookie: nks_session
Value: <jwt_token>
HttpOnly: ✅ (checkmark)
Secure: ✅ (in HTTPS)
SameSite: Strict
```

### Test 2: Verify localStorage Removed

**Console:**
```javascript
// Should be empty
localStorage.getItem('accessToken') // null
```

### Test 3: Verify CSRF Token

**Console:**
```javascript
// Should contain csrf_token
document.cookie
// Output: "csrf_token=abc123xyz789..."
```

### Test 4: XSS Attack Blocked

**Inject malicious script:**
```javascript
// This will NOT work anymore
localStorage.getItem('accessToken') // null
document.cookie = 'nks_session=fake' // Blocked (secure flag)
```

### Test 5: CSRF Protection

**Try form submission:**
```javascript
// POST without X-CSRF-Token header
fetch('/api/v1/users', {
  method: 'POST',
  credentials: 'include',
  // Missing X-CSRF-Token header
})
// Result: 403 Forbidden - CSRF token missing or invalid
```

### Test 6: CSP Headers

**Check response headers:**
```bash
curl -i http://localhost:4000/api/v1/auth/login

# Look for:
# Content-Security-Policy: default-src 'self'; script-src 'self'; ...
# Strict-Transport-Security: max-age=31536000
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

---

## 📋 Troubleshooting

### Issue: Cookie not being set

**Symptoms:** `localStorage.getItem('accessToken')` returns null, requests fail

**Check:**
1. Is response status 200? (Cookies only set on success)
2. Is NODE_ENV set? (Affects secure flag)
3. Are credentials being sent? (`credentials: 'include'` in frontend)

**Debug:**
```typescript
// In auth.controller.ts
private setSessionCookie(res: Response, token: string): void {
  console.log('Setting cookie:', {
    token: token.substring(0, 20) + '...',
    nodeEnv: process.env.NODE_ENV,
    secure: process.env.NODE_ENV === 'production',
  });
  // ... rest of code
}
```

### Issue: CSRF token validation failing

**Symptoms:** POST requests return 403 "CSRF token missing or invalid"

**Check:**
1. Is X-CSRF-Token header being sent?
2. Does it match the csrf_token cookie?
3. Is the route exempted? (login, register, refresh don't need it)

**Debug:**
```typescript
// In csrf.middleware.ts
const providedToken = req.headers['x-csrf-token'];
console.log({
  provided: providedToken,
  cookie: cookies['csrf_token'],
  match: providedToken === cookies['csrf_token'],
});
```

### Issue: CSP blocking resources

**Symptoms:** Console shows "Refused to load the script because it violates the Content Security Policy"

**Solution:** Add exception to CSP directives:
```typescript
scriptSrc: ["'self'", "https://trusted-cdn.com"],
styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
```

---

## 🔒 Security Benefits

| Attack | Before | After |
|--------|--------|-------|
| XSS Token Theft | ❌ Vulnerable | ✅ Protected (httpOnly) |
| CSRF | ❌ Vulnerable | ✅ Protected (CSRF token) |
| Clickjacking | ❌ Vulnerable | ✅ Protected (X-Frame-Options) |
| MIME Sniffing | ❌ Vulnerable | ✅ Protected (X-Content-Type-Options) |
| Inline Scripts | ❌ Vulnerable | ✅ Protected (CSP) |
| External Script Injection | ❌ Vulnerable | ✅ Protected (CSP) |

---

## 📚 References

- [MDN: httpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#security)
- [OWASP: CSRF Prevention](https://owasp.org/www-community/attacks/csrf)
- [OWASP: Content Security Policy](https://owasp.org/www-community/attacks/xss/#defense_code_review_checklist_csp)
- [Helmet.js Documentation](https://helmetjs.github.io/)

---

## ⚠️ Breaking Changes

**For Mobile Clients (React Native):**

If you're using the mobile client with this backend:

1. **Update axios config:**
```typescript
const API = axios.create({
  baseURL: process.env.API_URL,
  withCredentials: true, // ✅ Include cookies
});
```

2. **Remove localStorage usage:**
```typescript
// ❌ Remove this
localStorage.setItem('accessToken', token);

// ✅ Keep this (cookies handled automatically)
```

3. **Send CSRF token for mutations:**
```typescript
const csrfToken = localStorage.getItem('csrf_token'); // Get from cookie
API.post('/users', data, {
  headers: { 'X-CSRF-Token': csrfToken }
});
```

---

## 🎯 Next Steps

1. Deploy to staging
2. Run security tests
3. Monitor cookie usage in analytics
4. Deploy to production
5. Monitor error rates and user sessions
6. Remove any remaining localStorage auth code

---

## 📞 Support

For questions or issues:
1. Check troubleshooting section above
2. Enable debug logging in auth.controller.ts
3. Check browser DevTools → Network tab for Set-Cookie headers
4. Verify CORS allows credentials: `buildCorsConfig(configService)`
