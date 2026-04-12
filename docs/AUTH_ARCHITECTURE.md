# NKS Backend Authentication Architecture

**Date:** April 9, 2026
**Scope:** Complete backend authentication system documentation
**Target Audience:** Backend developers, security auditors, platform architects

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Request/Response Flows](#requestresponse-flows)
4. [Database Schema & Relationships](#database-schema--relationships)
5. [Security Implementation Layers](#security-implementation-layers)
6. [Token Lifecycle Management](#token-lifecycle-management)
7. [Key Architectural Decisions](#key-architectural-decisions)
8. [Service & Repository Layer](#service--repository-layer)
9. [File Structure & References](#file-structure--references)
10. [Error Handling & Edge Cases](#error-handling--edge-cases)

---

## Executive Summary

The NKS authentication system is a **multi-method, session-based architecture** with support for:
- Email + Password login
- Phone + OTP (MSG91 SMS provider) login
- Token refresh with automatic theft detection
- Session restoration on app launch
- Role-based access control (RBAC)
- Multi-layer security (password hashing, OTP verification, IP fingerprinting, brute-force protection)

**Key Metrics:**
- **18 total endpoints** (13 auth controller + 5 OTP controller)
- **4 login flows** (email/password, phone/OTP, guest, session restore)
- **3 token types** (access token, refresh token, session token)
- **7 security layers** (password, OTP, session, theft detection, brute-force, role changes, IP fingerprinting)
- **5 core database tables** (users, sessions, OTP requests, OTP verification, rate limiting)

---

## Authentication Endpoints

### Auth Controller (13 Endpoints)

**Base Path:** `POST /api/v1/auth`

#### 1. Register (Email)
```
POST /auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

Response (201):
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "globalRole": "USER",
      "isActive": true,
      "createdAt": "2026-04-09T10:00:00Z"
    },
    "session": {
      "sessionToken": "sess_abc123xyz",
      "sessionExpiresAt": "2026-04-16T10:00:00Z",
      "hashedSessionToken": "sha256(sessionToken)"
    },
    "access": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "ref_def456uvw",
      "accessTokenExpiresIn": 3600,
      "refreshTokenExpiresAt": "2026-05-09T10:00:00Z"
    },
    "authContext": {
      "authMethod": "EMAIL_PASSWORD",
      "loginAt": "2026-04-09T10:00:00Z"
    }
  }
}

Error (400/409):
{
  "success": false,
  "error": {
    "code": "AUTH_USER_EXISTS",
    "message": "User with this email already exists"
  }
}
```

#### 2. Login (Email)
```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response (200):
{
  "success": true,
  "data": {
    "user": { ... },
    "session": { ... },
    "access": { ... },
    "authContext": {
      "authMethod": "EMAIL_PASSWORD",
      "loginAt": "2026-04-09T10:00:00Z"
    }
  }
}

Error (401):
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### 3. Verify Email
```
POST /auth/verify-email
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "verificationToken": "verify_token_123"
}

Response (200):
{
  "success": true,
  "message": "Email verified successfully"
}
```

#### 4. Logout
```
POST /auth/logout
Authorization: Bearer <accessToken>

Request: (empty body)

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}

Backend Actions:
- Invalidates sessionToken in database
- Revokes refreshToken
- Terminates session record
- Clears all active tokens for user
```

#### 5. Refresh Token
```
POST /auth/refresh
Content-Type: application/json

Request:
{
  "refreshToken": "ref_def456uvw"
}

Response (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "ref_ghi789pqr",  // New refresh token issued
    "accessTokenExpiresIn": 3600,
    "refreshTokenExpiresAt": "2026-05-09T10:00:00Z"
  }
}

Theft Detection (Response 401):
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_REVOKED",
    "message": "Refresh token has been revoked",
    "reason": "Suspicious activity detected - multiple refresh attempts from different IPs"
  }
}

Backend Actions on Theft Detection:
- Immediately revoke refresh token
- Terminate user's current session
- Log theft detection event with IP addresses
- Optionally notify user via email
```

#### 6. Change Password
```
POST /auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}

Response (200):
{
  "success": true,
  "message": "Password changed successfully"
}

Backend Actions:
- Verify currentPassword matches (bcrypt comparison)
- Hash newPassword (bcrypt 12 rounds)
- Update user record
- Revoke all active refresh tokens
- Terminate all other sessions (force re-login)
```

#### 7. Forgot Password (Request)
```
POST /auth/forgot-password
Content-Type: application/json

Request:
{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "If account exists, password reset link has been sent"
}

Backend Actions:
- Check if email exists (don't reveal status)
- Generate reset token (secure random, 1-hour expiry)
- Send email with reset link
- Store token hash in database
```

#### 8. Forgot Password (Reset)
```
POST /auth/forgot-password/reset
Content-Type: application/json

Request:
{
  "resetToken": "reset_token_xyz",
  "newPassword": "NewPass456!"
}

Response (200):
{
  "success": true,
  "message": "Password reset successful"
}

Backend Actions:
- Validate reset token (hash comparison, expiry check)
- Hash newPassword
- Update user password
- Invalidate reset token
- Terminate all active sessions
```

#### 9. Verify Session
```
POST /auth/verify-session
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "sessionToken": "sess_abc123xyz"
}

Response (200):
{
  "success": true,
  "data": {
    "isValid": true,
    "user": { ... },
    "session": { ... }
  }
}
```

#### 10. Get Current User
```
GET /auth/me
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "globalRole": "USER",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2026-04-09T10:00:00Z",
      "updatedAt": "2026-04-09T10:00:00Z"
    }
  }
}
```

#### 11. Update Profile
```
PUT /auth/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+919876543210"
}

Response (200):
{
  "success": true,
  "data": { ... updated user object ... }
}
```

#### 12. Validate Token
```
POST /auth/validate-token
Content-Type: application/json

Request:
{
  "token": "eyJhbGc..."
}

Response (200):
{
  "success": true,
  "data": {
    "isValid": true,
    "expiresAt": "2026-04-09T11:00:00Z",
    "userId": 1
  }
}

Response (401):
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Token is invalid or expired"
  }
}
```

#### 13. Initialize Auth (Session Restore)
```
POST /auth/initialize
Content-Type: application/json

Request:
{
  "sessionToken": "sess_abc123xyz"
}

Response (200):
{
  "success": true,
  "data": {
    "user": { ... },
    "session": { ... },
    "access": { ... },
    "flags": { ... }  // Feature flags based on user role
  }
}

Backend Actions:
- Validate sessionToken (hash lookup)
- Check session not expired
- Check session not revoked
- Regenerate access/refresh tokens
- Verify no role changes since last login
```

---

### OTP Controller (5 Endpoints)

**Base Path:** `POST /api/v1/otp`

#### 1. Send OTP (Phone)
```
POST /otp/send
Content-Type: application/json

Request:
{
  "phone": "+919876543210"
}

Response (200):
{
  "success": true,
  "data": {
    "reqId": "msg91_request_id_abc123",
    "expiresIn": 600,  // 10 minutes
    "message": "OTP sent to your phone"
  }
}

Error (429 - Rate Limit):
{
  "success": false,
  "error": {
    "code": "OTP_RATE_LIMIT_EXCEEDED",
    "message": "Maximum OTP requests reached. Try again in 1 hour.",
    "retryAfter": 3600
  }
}

Backend Actions:
- Validate phone format (Indian format: +91XXXXXXXXXX)
- Check rate limiting (max 3 OTP requests per hour)
- Generate 6-digit OTP
- Call MSG91 API to send SMS
- Store OTP request with reqId
- Store hashed OTP in verification table
- Set 10-minute expiry
```

#### 2. Resend OTP
```
POST /otp/resend
Content-Type: application/json

Request:
{
  "reqId": "msg91_request_id_abc123"
}

Response (200):
{
  "success": true,
  "data": {
    "reqId": "msg91_request_id_def456",  // New reqId
    "expiresIn": 600,
    "message": "New OTP sent"
  }
}

Backend Actions:
- Validate original reqId exists
- Generate new OTP
- Send via MSG91
- Create new OTP request
- Invalidate previous OTP
```

#### 3. Verify OTP
```
POST /otp/verify
Content-Type: application/json

Request:
{
  "phone": "+919876543210",
  "otp": "123456",
  "reqId": "msg91_request_id_abc123"
}

Response (200):
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "phone": "+919876543210",
      "globalRole": "USER",
      "isActive": true,
      "createdAt": "2026-04-09T10:00:00Z"
    },
    "session": {
      "sessionToken": "sess_xyz789abc",
      "sessionExpiresAt": "2026-04-16T10:00:00Z"
    },
    "access": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "ref_mno012xyz",
      "accessTokenExpiresIn": 3600,
      "refreshTokenExpiresAt": "2026-05-09T10:00:00Z"
    },
    "authContext": {
      "authMethod": "PHONE_OTP",
      "loginAt": "2026-04-09T10:00:00Z"
    }
  }
}

Error (400 - Invalid OTP):
{
  "success": false,
  "error": {
    "code": "OTP_INVALID",
    "message": "Invalid or expired OTP"
  }
}

Error (429 - Brute Force):
{
  "success": false,
  "error": {
    "code": "OTP_ATTEMPTS_EXCEEDED",
    "message": "Maximum OTP verification attempts exceeded. Try again in 1 hour.",
    "retryAfter": 3600
  }
}

Backend Actions:
- Validate OTP format (6 digits)
- Lookup OTP request by reqId
- Verify OTP not expired (10-minute window)
- Compare OTP with stored hash (bcrypt)
- Increment attempt counter
- Check attempt limit (max 5 attempts)
- Find or create user by phone
- Create session + tokens
- Log auth event
```

#### 4. Validate OTP (Pre-verification check)
```
POST /otp/validate
Content-Type: application/json

Request:
{
  "otp": "123456",
  "reqId": "msg91_request_id_abc123"
}

Response (200):
{
  "success": true,
  "data": {
    "isValid": true
  }
}
```

#### 5. OTP Status
```
GET /otp/status/:reqId
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "data": {
    "reqId": "msg91_request_id_abc123",
    "status": "pending",  // pending, verified, expired
    "createdAt": "2026-04-09T10:00:00Z",
    "expiresAt": "2026-04-09T10:10:00Z",
    "attemptsRemaining": 3
  }
}
```

---

## Request/Response Flows

### Flow 1: Email + Password Login

```
USER                          FRONTEND                        BACKEND
  |                               |                              |
  | Enter email + password        |                              |
  |------- credentials ---------->|                              |
  |                               | POST /auth/login             |
  |                               |----------------------------->|
  |                               |                    - Validate email exists
  |                               |                    - Compare password (bcrypt)
  |                               |                    - Generate sessionToken
  |                               |                    - Hash sessionToken
  |                               |                    - Create session record
  |                               |                    - Generate JWT (access)
  |                               |                    - Generate refresh token
  |                               |                    - Store tokens in DB
  |                               |<----- AuthResponse ----------|
  |                               |                              |
  | Display workspace            |                              |
  | Save tokens to AsyncStorage  |                              |
  | Set Redux auth state         |                              |
  |                               |                              |
```

**Response Structure:**
```typescript
{
  user: {
    id, email, firstName, lastName, globalRole, isActive, createdAt
  },
  session: {
    sessionToken,        // 32-byte random hex string
    sessionExpiresAt,    // 7 days from now
    hashedSessionToken   // SHA256 hash for secure storage
  },
  access: {
    accessToken,         // JWT valid for 1 hour
    refreshToken,        // Opaque token valid for 30 days
    accessTokenExpiresIn,
    refreshTokenExpiresAt
  },
  authContext: {
    authMethod: "EMAIL_PASSWORD",
    loginAt
  }
}
```

---

### Flow 2: Phone + OTP Login (MSG91)

```
USER                          FRONTEND                        BACKEND
  |                               |                              |
  | Enter phone number            |                              |
  |------ +919876543210 -------->|                              |
  |                               | POST /otp/send              |
  |                               |----------------------------->|
  |                               |                    - Format validation
  |                               |                    - Rate limit check (3/hour)
  |                               |                    - Generate 6-digit OTP
  |                               |                    - Store OTP request
  |                               |                    - Call MSG91 API
  |                               |<----- reqId, expiresIn ------|
  |                               |                              |
  | [SMS received: "Your OTP..."] |                              |
  |                               |                              |
  | Enter OTP: 123456            |                              |
  |------ OTP + reqId ---------->|                              |
  |                               | POST /otp/verify             |
  |                               |----------------------------->|
  |                               |                    - Validate OTP format
  |                               |                    - Lookup OTP by reqId
  |                               |                    - Compare OTP (bcrypt)
  |                               |                    - Check expiry (10 min)
  |                               |                    - Increment attempts
  |                               |                    - Check attempt limit (5)
  |                               |                    - Find/create user
  |                               |                    - Create session + tokens
  |                               |<----- AuthResponse ----------|
  |                               |                              |
  | Display workspace            |                              |
  | Save tokens to AsyncStorage  |                              |
  | Set Redux auth state         |                              |
  |                               |                              |
```

**OTP Lifecycle:**
1. **Send**: Generate 6-digit OTP, send via SMS, store hash + reqId + timestamp
2. **Attempt**: User enters OTP, system compares with hash, increments counter
3. **Verify**: On correct OTP, mark as verified, create session
4. **Expire**: 10-minute window, auto-clear from database after
5. **Rate Limit**: Max 3 OTP sends per hour per phone, max 5 verify attempts per OTP

---

### Flow 3: Token Refresh (with Theft Detection)

```
FRONTEND                        BACKEND
  |                              |
  | 1-hour access token expires |
  |                              |
  | POST /auth/refresh           |
  | { refreshToken: "ref_..." } |
  |---------------------------->|
  |                    - Lookup refresh token in DB
  |                    - Verify token exists + not revoked
  |                    - Check expiry (30 days)
  |                    - Compare provided token with stored hash
  |                    - [NEW] Get user's last known IP
  |                    - [NEW] Compare with current request IP
  |                    - [NEW] If IP differs + within 1 minute → THEFT
  |<---- New tokens OR ---------|
  |      Token Revoked Error     |
  |                              |
  | [Normal case]                |
  | Store new accessToken        |
  | Continue with API calls      |
  |                              |
  | [Theft detected]             |
  | Force logout all sessions    |
  | Require fresh login          |
  |                              |
```

**Theft Detection Logic:**
```
IF (refreshToken.lastUsedIp != currentRequest.ip) {
  IF (timeSinceLastUse < 60 seconds) {
    → THEFT DETECTED
    → Revoke all tokens
    → Terminate session
    → Log security event
    → Optionally email user
  }
}
```

---

### Flow 4: Session Restoration on App Launch

```
APP LAUNCH                    FRONTEND                        BACKEND
  |                               |                              |
  | [Check AsyncStorage]          |                              |
  | sessionToken found?           |                              |
  |                               |                              |
  | YES: Restore session          |                              |
  |     Dispatch initializeAuth   |                              |
  |                               | POST /auth/initialize        |
  |                               |----------------------------->|
  |                               |                    - Hash sessionToken
  |                               |                    - Lookup in sessions
  |                               |                    - Verify not expired
  |                               |                    - Verify not revoked
  |                               |                    - Check role changes
  |                               |                    - Generate new tokens
  |                               |<----- AuthResponse ----------|
  |                               |                              |
  | Update Redux auth state       |                              |
  | Hide splash screen            |                              |
  | Route to workspace            |                              |
  |                               |                              |
  | NO: sessionToken missing      |                              |
  |     Show login screen         |                              |
  |                               |                              |
```

**Redux State Lifecycle:**
```typescript
initialState = {
  isInitializing: true,        // Splash screen visible
  isAuthenticated: false,
  authResponse: null,
  loginState: { ... }
}

// On app launch
// → dispatch(initializeAuth())
// → pending: isInitializing = true
// → fulfilled: isInitializing = false, isAuthenticated = true, authResponse = {...}
// → rejected: isInitializing = false, isAuthenticated = false

// AuthProvider:
// if (!isInitializing) {
//   if (isAuthenticated) → <WorkspaceLayout />
//   else → <LoginLayout />
// }
```

---

## Database Schema & Relationships

### Table 1: `users`

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  passwordHash VARCHAR(255),  -- bcrypt 12 rounds
  globalRole VARCHAR(30) NOT NULL,  -- ENUM: SUPER_ADMIN, USER, STORE_OWNER, STAFF
  isActive BOOLEAN DEFAULT true,
  emailVerified BOOLEAN DEFAULT false,
  emailVerifiedAt TIMESTAMP,
  lastLoginAt TIMESTAMP,
  lastLoginIp VARCHAR(45),  -- IPv4 or IPv6
  ipFingerprint VARCHAR(255),  -- SHA256 hash of User-Agent + Accept-Language
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP NULL
);

INDEX: email, phone, globalRole, isActive
```

**Key Fields:**
- `globalRole`: Enum for primary authorization (SUPER_ADMIN, USER, STORE_OWNER, STAFF)
- `ipFingerprint`: Device identifier (prevents token theft from different devices)
- `lastLoginIp`: Comparison point for refresh token theft detection
- `lastLoginAt`: Audit trail

---

### Table 2: `sessions`

```sql
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  userId BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessionToken VARCHAR(255) NOT NULL UNIQUE,  -- 32-byte hex random
  hashedSessionToken VARCHAR(255) NOT NULL UNIQUE,  -- SHA256(sessionToken)
  refreshToken VARCHAR(255) NOT NULL UNIQUE,
  hashedRefreshToken VARCHAR(255) NOT NULL UNIQUE,  -- SHA256(refreshToken)
  accessToken VARCHAR(2048),  -- JWT
  lastUsedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastUsedIp VARCHAR(45),
  userAgent VARCHAR(500),
  ipFingerprint VARCHAR(255),  -- SHA256 of request headers
  expiresAt TIMESTAMP NOT NULL,  -- sessionExpiresAt
  refreshTokenExpiresAt TIMESTAMP NOT NULL,
  isRevoked BOOLEAN DEFAULT false,
  revokedAt TIMESTAMP NULL,
  revokeReason VARCHAR(255),  -- "USER_LOGOUT", "THEFT_DETECTED", "PASSWORD_CHANGED"
  authMethod VARCHAR(30),  -- EMAIL_PASSWORD, PHONE_OTP, GUEST
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INDEX: userId, sessionToken, hashedSessionToken, refreshToken, isRevoked
```

**Key Fields:**
- `sessionToken` / `hashedSessionToken`: Mobile app session identifier (sent via AsyncStorage)
- `refreshToken` / `hashedRefreshToken`: Used for token refresh endpoint
- `lastUsedIp`: Compared against current request IP for theft detection
- `ipFingerprint`: Header-based device identifier
- `isRevoked`: Soft delete for session invalidation
- `revokeReason`: Audit trail for why session was revoked

---

### Table 3: `otp_requests`

```sql
CREATE TABLE otp_requests (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  reqId VARCHAR(255) UNIQUE NOT NULL,  -- MSG91 request ID
  otpLength INTEGER DEFAULT 6,
  expiresAt TIMESTAMP NOT NULL,  -- Current time + 600 seconds
  isVerified BOOLEAN DEFAULT false,
  verifiedAt TIMESTAMP NULL,
  attemptsRemaining INTEGER DEFAULT 5,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INDEX: phone, reqId, expiresAt
```

**Key Fields:**
- `reqId`: Unique identifier from MSG91 API response
- `expiresAt`: 10-minute window from creation
- `attemptsRemaining`: Brute-force protection (max 5 attempts)
- `isVerified`: Tracks completion status

---

### Table 4: `otp_verification`

```sql
CREATE TABLE otp_verification (
  id BIGSERIAL PRIMARY KEY,
  otpRequestId BIGINT NOT NULL REFERENCES otp_requests(id) ON DELETE CASCADE,
  otpHash VARCHAR(255) NOT NULL,  -- bcrypt(OTP)
  phoneE164 VARCHAR(20) NOT NULL,  -- Normalized format: +919876543210
  attemptsCount INTEGER DEFAULT 0,
  isCorrect BOOLEAN DEFAULT false,
  verifiedAt TIMESTAMP NULL,
  failedAttempts JSONB,  -- Array of {timestamp, ip, userAgent}
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INDEX: otpRequestId, phoneE164
```

**Key Fields:**
- `otpHash`: Bcrypt hash of actual OTP (never stored plaintext)
- `attemptsCount`: Incremented on each verify attempt
- `failedAttempts`: Detailed log of incorrect attempts with IP + User-Agent

---

### Table 5: `rate_limits`

```sql
CREATE TABLE rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,  -- phone or email
  action VARCHAR(50) NOT NULL,  -- OTP_SEND, OTP_VERIFY, LOGIN
  attemptsCount INTEGER DEFAULT 1,
  windowExpiresAt TIMESTAMP NOT NULL,  -- Current time + window duration
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(identifier, action, windowExpiresAt)
);

INDEX: identifier, action, windowExpiresAt
```

**Rate Limit Rules:**
```
OTP_SEND:
  - Max 3 attempts per hour
  - Window: 3600 seconds
  - Block: 1 hour

OTP_VERIFY:
  - Max 5 attempts per 10 minutes
  - Window: 600 seconds
  - Block: 1 hour (enforced in otp_verification.failedAttempts)

LOGIN:
  - Max 5 attempts per 15 minutes
  - Window: 900 seconds
  - Block: 1 hour
```

---

### Relationships Diagram

```
users (1) ←──── sessions (many)
  ↓
users (1) ←──── otp_requests (many)
  ↓
  └─→ otp_verification (many)
        ↓
        otp_requests (1)

rate_limits
  (independent table, referenced by identifier not FK)
```

---

## Security Implementation Layers

### Layer 1: Password Security

**Storage:**
```typescript
// On register/password reset
const passwordHash = await bcrypt.hash(password, 12);
await db.users.update({ id }, { passwordHash });

// On login
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) throw new UnauthorizedException('Invalid credentials');
```

**Requirements:**
- Minimum 12 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Cannot match previous 3 passwords (maintain history)
- Bcrypt cost factor: 12 (resistant to modern GPU attacks)

**Expiry & Rotation:**
- Password expires every 90 days
- On expiry, user must change password before accessing protected routes
- Password history kept for 12 months

---

### Layer 2: OTP Verification

**Generation & Storage:**
```typescript
// Generate
const otp = crypto.randomInt(100000, 999999).toString();  // 6-digit number

// Store hash (never plaintext)
const otpHash = await bcrypt.hash(otp, 10);
await db.otp_verification.create({ otpHash, otpRequestId });

// Comparison on verify
const isValid = await bcrypt.compare(providedOtp, storedHash);
```

**Constraints:**
- 6 digits only (100,000 - 999,999)
- 10-minute expiry (from creation timestamp)
- Max 5 verification attempts (brute-force protection)
- Auto-generated via MSG91 API (not predictable)

**SMS Security:**
- Phone numbers normalized to E.164 format (+cc + 10 digits)
- OTP never shown in logs (masked as ***)
- Resend invalidates previous OTP (prevents collision attacks)

---

### Layer 3: Session Security

**Token Generation:**
```typescript
// Session token (mobile app storage)
const sessionToken = crypto.randomBytes(32).toString('hex');  // 64-char hex string
const hashedSessionToken = crypto.createHash('sha256')
  .update(sessionToken).digest('hex');  // Store hash only

// Access token (JWT with expiry)
const accessToken = jwt.sign(
  { userId, sessionId, role },
  JWT_SECRET,
  { expiresIn: '1h', issuer: 'nks-auth' }
);

// Refresh token (opaque, database-backed)
const refreshToken = crypto.randomBytes(32).toString('hex');
const hashedRefreshToken = crypto.createHash('sha256')
  .update(refreshToken).digest('hex');
```

**Session Lifecycle:**
- Created on successful login (email, OTP, or register)
- Refreshable for 30 days (via refresh token)
- Expires and auto-cleaned from database after 30 days
- Can be revoked early (logout, theft detection, password change)
- Tracks last used IP + User-Agent for anomaly detection

**Token Transmission:**
```typescript
// In HTTP headers
Authorization: Bearer <accessToken>

// In body (refresh endpoint only)
{
  "refreshToken": "<refresh_token>"
}

// In AsyncStorage (mobile only)
{
  "sessionToken": "<session_token>",  // For app restart
  "accessToken": "<access_token>",    // For API calls
  "refreshToken": "<refresh_token>"   // For token refresh
}
```

---

### Layer 4: Token Theft Detection

**Mechanism:**
```typescript
// On token refresh
const session = db.sessions.find(s => s.hashedRefreshToken === hash(providedToken));

// Compare IPs
const lastUsedIp = session.lastUsedIp;
const currentIp = request.ip;

if (lastUsedIp !== currentIp) {
  // Different IP detected
  const timeSinceLastUse = Date.now() - session.lastUsedAt;

  if (timeSinceLastUse < 60 * 1000) {  // Less than 1 minute
    // Token used from 2 different IPs in < 1 minute = THEFT
    await revokeAllUserSessions(session.userId, 'THEFT_DETECTED');
    throw new UnauthorizedException('Account compromised. Please login again.');
  }
}

// Update last used info
session.lastUsedAt = Date.now();
session.lastUsedIp = currentIp;
session.save();
```

**Response on Theft Detection:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_REVOKED",
    "message": "Refresh token has been revoked",
    "reason": "Suspicious activity detected - token refresh from different IP within 1 minute"
  }
}
```

**Actions on Theft:**
- Revoke all active refresh tokens immediately
- Terminate all sessions for user
- Force logout across all devices
- Send security alert email to user
- Log security event with IP addresses + timestamps
- Trigger manual review if repeated offenses

---

### Layer 5: Brute-Force Protection

**OTP Verification Attacks:**
```typescript
const attempt = db.otp_verification.findById(otpRequestId);

if (attempt.attemptsCount >= 5) {
  // Block further attempts for 1 hour
  throw new TooManyRequestsException({
    code: 'OTP_ATTEMPTS_EXCEEDED',
    message: 'Maximum attempts exceeded. Try again in 1 hour.',
    retryAfter: 3600
  });
}

// Log failed attempt
attempt.failedAttempts.push({
  timestamp: Date.now(),
  ip: request.ip,
  userAgent: request.headers['user-agent']
});

attempt.attemptsCount++;
attempt.save();
```

**Rate Limiting:**
```typescript
const limit = await db.rate_limits.findOne({
  identifier: phone,
  action: 'OTP_SEND',
  windowExpiresAt: { $gt: Date.now() }
});

if (limit && limit.attemptsCount >= 3) {
  throw new TooManyRequestsException({
    code: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP requests. Try again in 1 hour.',
    retryAfter: 3600
  });
}
```

---

### Layer 6: Role-Change Detection

**On Session Validation:**
```typescript
const currentSession = db.sessions.findById(sessionId);
const currentUser = db.users.findById(currentSession.userId);

if (currentUser.globalRole !== currentSession.originalRole) {
  // User role changed since login
  // Force immediate logout and re-authentication
  await revokeSession(sessionId, 'ROLE_CHANGED');
  throw new UnauthorizedException('Your permissions have changed. Please login again.');
}
```

**Trigger Points:**
- Admin updates user role
- User's store assignment changes
- User's custom role changes
- Detected during token validation or session refresh

---

### Layer 7: IP Fingerprinting & Device Binding

**Fingerprint Generation:**
```typescript
const generateFingerprint = (request) => {
  const userAgent = request.headers['user-agent'];
  const acceptLanguage = request.headers['accept-language'];
  const acceptEncoding = request.headers['accept-encoding'];

  const fingerprint = crypto.createHash('sha256')
    .update(`${userAgent}${acceptLanguage}${acceptEncoding}`)
    .digest('hex');

  return fingerprint;
};
```

**Usage:**
```typescript
// On login
const fingerprint = generateFingerprint(request);
session.ipFingerprint = fingerprint;

// On token refresh
if (request.ipFingerprint !== session.ipFingerprint) {
  // Different device detected
  if (request.ip === session.lastUsedIp) {
    // Same IP, different User-Agent - possible login from mobile + web simultaneously
    // Allow (return warning) OR require re-auth (return 401)
  }
}
```

---

## Token Lifecycle Management

### Access Token (JWT)

**Generation:**
```typescript
const accessToken = jwt.sign(
  {
    userId: user.id,
    sessionId: session.id,
    globalRole: user.globalRole,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600  // 1 hour
  },
  process.env.JWT_SECRET,
  {
    issuer: 'nks-auth-service',
    algorithm: 'HS256',
    subject: `user:${user.id}`
  }
);
```

**Validation:**
```typescript
const payload = jwt.verify(token, JWT_SECRET);

// Check expiry
if (payload.exp < Math.floor(Date.now() / 1000)) {
  throw new UnauthorizedException('Token expired');
}

// Check signature
if (payload.iss !== 'nks-auth-service') {
  throw new UnauthorizedException('Invalid issuer');
}

// Check against blacklist (if revoked)
const isBlacklisted = await db.token_blacklist.exists({ token: hash(token) });
if (isBlacklisted) {
  throw new UnauthorizedException('Token revoked');
}
```

**Expiry Handling:**
- 1-hour expiration (short-lived, reduces compromise risk)
- Automatically renewed via refresh endpoint
- No grace period (strict enforcement)
- On expiry, frontend automatically calls refresh endpoint (transparent to user)

---

### Refresh Token

**Generation:**
```typescript
const refreshToken = crypto.randomBytes(32).toString('hex');  // 64-char hex string

await db.sessions.update(sessionId, {
  refreshToken,
  hashedRefreshToken: hash(refreshToken),
  refreshTokenExpiresAt: addDays(Date.now(), 30)
});
```

**Usage:**
```typescript
// Frontend (automatic on access token expiry)
const response = await api.post('/auth/refresh', {
  refreshToken: storedRefreshToken
});

// Returns new accessToken + refreshToken (rotation)
const { accessToken, refreshToken } = response.data;

// Update local storage
await AsyncStorage.setItem('accessToken', accessToken);
await AsyncStorage.setItem('refreshToken', refreshToken);
```

**Rotation:**
- New refresh token issued on every refresh call (invalidates old one)
- Client must use new token for next refresh
- Prevents token replay attacks

**Expiry Handling:**
- 30-day expiration (allows offline usage periods)
- If expired, user must login fresh
- Longer window than access token (reduces login friction)

---

### Session Token (Mobile)

**Purpose:**
```typescript
// Unique identifier for this app session on this device
// Used to restore login state on app restart
// Not used for API auth (accessToken is used instead)
```

**Storage:**
```typescript
// React Native AsyncStorage (persistent)
const sessionToken = response.session.sessionToken;
await AsyncStorage.setItem('sessionToken', sessionToken);

// On app launch, check if sessionToken exists
// If yes → dispatch initializeAuth({ sessionToken })
// If no → show login screen
```

**Comparison with Access Token:**
| Aspect | Session Token | Access Token |
|--------|---|---|
| **Type** | Opaque (random hex) | JWT |
| **Storage** | AsyncStorage | Memory + AsyncStorage |
| **Expiry** | 7 days | 1 hour |
| **Purpose** | App session restore | API authorization |
| **Transmission** | POST body (initialize) | HTTP Authorization header |
| **Refresh** | Via initializeAuth | Via /auth/refresh endpoint |

---

## Key Architectural Decisions

### Decision 1: Session-First Architecture

**Why not pure JWT?**
- JWT is stateless, but we need to revoke tokens immediately (logout, theft detection, password change)
- Checking blacklist for every request negates JWT's "no database lookup" benefit
- Session table enables fast revocation without hitting auth service

**Why Session Token + Access Token?**
- Session token: Survives app restarts, stays in AsyncStorage
- Access token: Short-lived JWT, used for every API call, refreshed hourly
- Dual tokens prevent: token theft (access token is short-lived), forced login on every request (session token enables restore)

---

### Decision 2: Hashed Token Storage

**Pattern:**
```
Generated Token (client)    Hashed Token (database)
─────────────────────────── ──────────────────────
sessionToken                SHA256(sessionToken)
refreshToken                SHA256(refreshToken)
```

**Why hash in database?**
- If database is compromised, attacker cannot directly use tokens
- Must reverse-engineer hash (computationally infeasible for cryptographic hashes)
- Client never sees hashes, only plain tokens

**Comparison Logic:**
```typescript
// To verify client's token against database
const providedToken = request.body.refreshToken;
const hashedProvided = crypto.createHash('sha256')
  .update(providedToken).digest('hex');

const stored = await db.sessions.findOne({
  hashedRefreshToken: hashedProvided
});

if (!stored) throw new UnauthorizedException('Invalid token');
```

---

### Decision 3: Circular Dependency Resolution

**Problem:**
```
OtpService ──depends on──> AuthService (to create session)
     ↑                              │
     │      ←──depends on──────────┘
  (AuthService calls OtpService for some flows)
```

**Solution: OtpAuthOrchestrator**
```typescript
// OtpAuthOrchestrator (new service)
//  ├─> OtpService (verify OTP)
//  └─> AuthService (create session + tokens)

// Dependency graph (acyclic)
OtpAuthOrchestrator ──> OtpService
         ↓
OtpAuthOrchestrator ──> AuthService
```

**Inject orchestrator into controller, not individual services.**

---

### Decision 4: MSG91 Integration Pattern

**Synchronous vs Async:**
- Send OTP: Synchronous (wait for SMS delivery confirmation)
- Verify OTP: MSG91 not involved (verify locally against stored hash)

**Why not rely on MSG91's verification API?**
- Additional latency + third-party dependency
- We own the OTP hashes, can verify instantly
- Reduces likelihood of MSG91 API downtime affecting verification

**Error Handling:**
```typescript
try {
  const msg91Response = await msg91.sendSms(phone, otp);
  return { reqId: msg91Response.id, expiresIn: 600 };
} catch (err) {
  // MSG91 API down, but OTP created in our DB
  throw new ServiceUnavailableException({
    code: 'SMS_SERVICE_UNAVAILABLE',
    message: 'Unable to send OTP. Please try again in 1 minute.'
  });
  // User can retry sendOtp, which generates new OTP
}
```

---

### Decision 5: Stateless vs Stateful Token Refresh

**Stateful (Current Approach):**
- Database lookup on every refresh
- Enables theft detection (IP comparison)
- Enables rate limiting
- Enables revocation
- **Trade-off**: More DB queries

**Stateless Alternative (JWT only):**
- No database lookup needed
- No theft detection
- Cannot revoke
- **Trade-off**: Simpler infrastructure, less secure

**Why Stateful?**
- Security requirements (theft detection, revocation) outweigh latency cost
- Database is cached/optimized anyway
- Real-time protection > marginal performance gain

---

### Decision 6: OTP Expiry Window (10 Minutes)

**Why 10 minutes?**
- Long enough: User has time to retrieve SMS + enter code
- Short enough: If OTP intercepted, attacker's window is limited
- Standard: Industry standard for SMS OTP (banks, auth services)

**Rate Limiting Alignment:**
- OTP expires in 10 minutes
- Failed attempt counter resets every 1 hour
- Allows user to request new OTP if window expires

---

### Decision 7: Role-Based Authorization (RBAC) Over Feature Flags

**For login/registration flows:**
- Simple role check (globalRole)
- No feature flags needed

**For workspace/routes:**
- Complex role check (custom roles + system roles)
- Feature flags + routes API (see ROUTES_ENDPOINTS_IMPLEMENTED.md)

**Why separate concerns?**
- Auth flows are security-critical, must be fast + reliable
- Routes/features are business-logic, can be dynamic

---

## Service & Repository Layer

### Auth Service Core Methods

```typescript
class AuthService {
  // Registration
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // 1. Validate email not exists
    // 2. Hash password (bcrypt 12)
    // 3. Create user record
    // 4. Create session
    // 5. Generate tokens
    // 6. Return AuthResponse
  }

  // Login
  async login(dto: LoginDto): Promise<AuthResponse> {
    // 1. Find user by email
    // 2. Verify password (bcrypt compare)
    // 3. Create new session (invalidate old ones? or allow multi-session?)
    // 4. Generate tokens
    // 5. Return AuthResponse
  }

  // Session restoration
  async initializeAuth(sessionToken: string): Promise<AuthResponse> {
    // 1. Hash sessionToken
    // 2. Find session in DB
    // 3. Verify not expired
    // 4. Verify not revoked
    // 5. Check role unchanged
    // 6. Generate new access/refresh tokens
    // 7. Return AuthResponse
  }

  // Token refresh
  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    // 1. Find session by hashed refresh token
    // 2. Verify token not revoked
    // 3. Compare IPs (theft detection)
    // 4. Update lastUsedIp
    // 5. Issue new access + refresh tokens
    // 6. Return tokens
  }

  // Logout
  async logout(sessionId: string): Promise<void> {
    // 1. Find session
    // 2. Set isRevoked = true
    // 3. Clear tokens
  }
}
```

---

### OTP Service Core Methods

```typescript
class OtpService {
  // Send OTP
  async sendOtp(phone: string): Promise<OtpSendResponse> {
    // 1. Format validation (E.164)
    // 2. Rate limit check (3/hour)
    // 3. Generate 6-digit OTP
    // 4. Create OTP request record
    // 5. Hash OTP + store in verification table
    // 6. Call MSG91 API
    // 7. Return reqId + expiresIn
  }

  // Verify OTP
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    // 1. Validate OTP format (6 digits)
    // 2. Find OTP request by reqId
    // 3. Check not expired
    // 4. Increment attempts counter
    // 5. Check attempts limit
    // 6. Compare OTP hash (bcrypt)
    // 7. Find or create user by phone
    // 8. Create session
    // 9. Generate tokens
    // 10. Return AuthResponse
  }

  // Resend OTP
  async resendOtp(reqId: string): Promise<OtpSendResponse> {
    // 1. Find original OTP request
    // 2. Generate new OTP
    // 3. Send via MSG91
    // 4. Create new OTP request record
    // 5. Invalidate previous OTP
    // 6. Return new reqId
  }
}
```

---

### Repository Methods

```typescript
class SessionRepository {
  // Create session after login
  create(userId: string, sessionData: SessionData): Promise<Session>

  // Find session by hashed session token
  findByHashedSessionToken(hash: string): Promise<Session | null>

  // Find session by hashed refresh token
  findByHashedRefreshToken(hash: string): Promise<Session | null>

  // Update last used info
  updateLastUsed(sessionId: string, ip: string): Promise<void>

  // Revoke session
  revoke(sessionId: string, reason: string): Promise<void>

  // Revoke all user sessions
  revokeAllForUser(userId: string, reason: string): Promise<void>

  // Find active sessions for user
  findActiveForUser(userId: string): Promise<Session[]>
}

class OtpRepository {
  // Create OTP request
  create(phone: string, reqId: string): Promise<OtpRequest>

  // Find OTP request
  findByReqId(reqId: string): Promise<OtpRequest | null>

  // Store OTP verification hash
  storeVerification(otpRequestId: string, hash: string): Promise<void>

  // Get verification record
  getVerification(otpRequestId: string): Promise<OtpVerification | null>

  // Increment attempts
  incrementAttempts(otpVerificationId: string): Promise<void>

  // Mark as verified
  markVerified(otpVerificationId: string): Promise<void>
}
```

---

## File Structure & References

```
nks/
├── apps/
│   └── nks-backend/
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   │   ├── auth.controller.ts          (13 endpoints)
│           │   │   ├── auth.service.ts             (core logic)
│           │   │   ├── auth.module.ts              (DI)
│           │   │   ├── otp.controller.ts           (5 endpoints)
│           │   │   ├── otp.service.ts              (OTP logic)
│           │   │   ├── otp-auth-orchestrator.ts   (circular dep resolution)
│           │   │   ├── refresh-token.service.ts    (theft detection)
│           │   │   ├── services/
│           │   │   │   ├── validators/
│           │   │   │   │   ├── phone.validator.ts
│           │   │   │   │   ├── email.validator.ts
│           │   │   │   │   ├── otp-request.validator.ts
│           │   │   │   │   └── password.validator.ts
│           │   │   │   └── msg91.service.ts        (SMS provider)
│           │   │   └── repositories/
│           │   │       ├── users.repository.ts
│           │   │       ├── sessions.repository.ts
│           │   │       └── otp.repository.ts
│           │   └── ...
│           └── core/
│               └── database/
│                   ├── schema/
│                   │   ├── users/users.table.ts
│                   │   ├── sessions/sessions.table.ts
│                   │   ├── otp-requests/otp-requests.table.ts
│                   │   ├── otp-verification/otp-verification.table.ts
│                   │   └── rate-limits/rate-limits.table.ts
│                   └── migrations/
│                       ├── 001_users.sql
│                       ├── 002_sessions.sql
│                       ├── 003_otp_requests.sql
│                       ├── 004_otp_verification.sql
│                       └── 005_rate_limits.sql
└── libs/
    └── api-manager/
        ├── src/
        │   ├── lib/
        │   │   └── auth/
        │   │       ├── api-thunk.ts         (sendOtp, verifyOtp, otpResend)
        │   │       ├── request-dto.ts       (SendOtpRequest, VerifyOtpRequest)
        │   │       └── response-dto.ts      (AuthResponse, OtpResponse)
        │   └── index.ts                     (exports)
        └── package.json
```

---

## Error Handling & Edge Cases

### Error Codes Reference

```typescript
// Auth errors
AUTH_USER_EXISTS              // 409: Email already registered
AUTH_INVALID_CREDENTIALS      // 401: Wrong password
AUTH_INVALID_TOKEN            // 401: Token invalid/expired
AUTH_TOKEN_REVOKED            // 401: Token revoked (theft/logout)
AUTH_UNAUTHORIZED             // 401: No token provided
AUTH_PERMISSION_DENIED        // 403: Insufficient permissions
AUTH_SESSION_EXPIRED          // 401: Session expired

// OTP errors
OTP_INVALID                   // 400: Wrong OTP code
OTP_EXPIRED                   // 400: OTP expired (> 10 min)
OTP_RATE_LIMIT_EXCEEDED       // 429: Max sends per hour
OTP_ATTEMPTS_EXCEEDED         // 429: Max verification attempts
OTP_INVALID_PHONE             // 400: Phone format invalid

// Validation errors
VALIDATION_ERROR              // 400: Input validation failed
INVALID_EMAIL_FORMAT          // 400
INVALID_PHONE_FORMAT          // 400
PASSWORD_TOO_WEAK             // 400

// Server errors
INTERNAL_SERVER_ERROR         // 500
SMS_SERVICE_UNAVAILABLE       // 503: MSG91 API down
DATABASE_ERROR                // 500: DB operation failed
```

---

### Edge Case 1: Session Expiry During API Request

**Scenario:**
```
1. User logged in 7 days ago
2. App was in background entire time
3. User brings app to foreground
4. Makes API call with old access token
5. Access token already expired
```

**Handling:**
```typescript
// Frontend interceptor
if (response.status === 401 && response.error.code === 'AUTH_INVALID_TOKEN') {
  // Try refresh
  const newAccessToken = await api.post('/auth/refresh', {
    refreshToken: storedRefreshToken
  });

  if (newAccessToken) {
    // Retry original request with new token
    return retryRequest(originalRequest);
  } else {
    // Refresh also failed, force logout
    dispatch(logout());
    navigate('/login');
  }
}
```

---

### Edge Case 2: Concurrent OTP Sends

**Scenario:**
```
1. User taps "Send OTP"
2. Before response, user taps again
3. Two simultaneous requests hit backend
```

**Handling:**
```typescript
// Database-level: rate_limits table with unique constraint
CREATE UNIQUE INDEX rate_limits_unique_window
  ON rate_limits(identifier, action, LOWER(window_expires_at))
  WHERE window_expires_at > NOW();

// First request: INSERT succeeds, attemptsCount = 1
// Second request: UPDATE same row, attemptsCount = 2
// Both within rate limit (3/hour), both succeed

// But: User sees OTP sent twice (annoying, not security issue)
// Solution: Frontend debounce (disable button for 2 seconds)
```

---

### Edge Case 3: Refresh Token Stolen, Used Legitimately

**Scenario:**
```
1. Attacker steals refresh token
2. Attacker makes request from IP 203.0.113.1 at 10:00:00 UTC
3. Token refresh succeeds, returns new token
4. Legitimate user is in IP 203.0.113.2
5. Legitimate user's token refresh at 10:00:30 UTC (30 sec later)
```

**Handling:**
```
Check 1: IP different (203.0.113.1 vs 203.0.113.2)
Check 2: Time difference is 30 seconds (> 60 sec threshold)
Result: Different IPs but enough time passed → ALLOW
(Assumes legitimate user might switch networks)

BUT if:
- Refresh from 203.0.113.1 at 10:00:00
- Refresh from 203.0.113.2 at 10:00:05 (5 seconds later)
- Different IPs + < 60 sec threshold = THEFT DETECTED
```

---

### Edge Case 4: User Changes Password During Session

**Scenario:**
```
1. User logged in, has active session
2. User navigates to /settings/change-password
3. User enters old + new password
4. Password updated in DB
5. All refresh tokens for user revoked
6. User continues using old access token (still valid for 1 hour)
```

**Handling:**
```typescript
// On next refresh attempt (after 1 hour or on app restart)
const session = findSession(sessionId);
const user = findUser(session.userId);

if (user.passwordHash !== session.passwordHashAtLogin) {
  // Password changed since login
  throw new UnauthorizedException('Please login again');
  // Force user to re-enter new password
}
```

---

### Edge Case 5: OTP Request from Multiple Phones Same Person

**Scenario:**
```
1. User requests OTP on +919876543210 (personal phone)
2. User requests OTP on +919876543211 (work phone)
3. One OTP code accidentally sent to both numbers
4. User enters same code on both devices
```

**Handling:**
```typescript
// Each OTP request has unique reqId from MSG91
// Even if OTP code is same, reqId differs
const verification1 = verifyOtp({
  phone: '+919876543210',
  otp: '123456',
  reqId: 'msg91_request_id_abc'  // Request 1
});

const verification2 = verifyOtp({
  phone: '+919876543211',
  otp: '123456',
  reqId: 'msg91_request_id_def'  // Request 2
});

// Both succeed, create 2 independent sessions
// User can be logged in on both devices simultaneously
// (No conflict, separate sessions)
```

---

### Edge Case 6: Email Domain Validation

**Scenario:**
```
User enters: admin+test@example.com
vs
User registers: admin@example.com
Later attempts login with: admin+test@example.com
```

**Handling:**
```typescript
// Normalize email before lookup
const normalizeEmail = (email: string) => {
  return email.toLowerCase().trim();
};

// On register
const normalized = normalizeEmail(email);
const exists = await db.users.findOne({ email: normalized });
if (exists) throw new ConflictException('Email already registered');

// On login
const user = await db.users.findOne({
  email: normalizeEmail(loginEmail)
});
if (!user) throw new UnauthorizedException('Invalid credentials');
```

---

## Summary Table: 18 Endpoints Overview

| # | Endpoint | Method | Auth | Purpose |
|---|----------|--------|------|---------|
| 1 | `/auth/register` | POST | None | Create user account + session |
| 2 | `/auth/login` | POST | None | Email + password login |
| 3 | `/auth/verify-email` | POST | None | Confirm email ownership |
| 4 | `/auth/logout` | POST | Yes | Invalidate session + tokens |
| 5 | `/auth/refresh` | POST | None | Renew access token |
| 6 | `/auth/change-password` | POST | Yes | Update user password |
| 7 | `/auth/forgot-password` | POST | None | Send reset email |
| 8 | `/auth/forgot-password/reset` | POST | None | Reset password via token |
| 9 | `/auth/verify-session` | POST | Yes | Validate session + token |
| 10 | `/auth/me` | GET | Yes | Get current user profile |
| 11 | `/auth/profile` | PUT | Yes | Update user profile |
| 12 | `/auth/validate-token` | POST | None | Check if token valid |
| 13 | `/auth/initialize` | POST | None | Restore session from token |
| 14 | `/otp/send` | POST | None | Request OTP via SMS |
| 15 | `/otp/resend` | POST | None | Request new OTP |
| 16 | `/otp/verify` | POST | None | Verify OTP + login |
| 17 | `/otp/validate` | POST | None | Check OTP without login |
| 18 | `/otp/status` | GET | Yes | Get OTP request status |

---

## Key Takeaways for Implementation

1. **Session + JWT Hybrid**: Use session tokens for app persistence, JWTs for API auth
2. **Hash All Secrets**: Never store plaintext tokens in database
3. **Theft Detection**: Compare IPs on token refresh, revoke on mismatch within 60 seconds
4. **Rate Limiting**: Enforce limits at entry point (controller), track in rate_limits table
5. **Bcrypt Cost**: Use cost factor 12 for passwords, 10 for OTP hashes
6. **Expiry Windows**: 1 hour for access, 30 days for refresh, 10 minutes for OTP
7. **Error Messages**: Avoid revealing whether email/phone exists (security)
8. **Circular Dependencies**: Use orchestrator pattern to bridge services
9. **Database Indexes**: Index frequently-queried columns (userId, phone, email, hashed tokens)
10. **Audit Trails**: Log all security events (login, logout, theft, password change, role change)

---

**Document Version:** 1.0
**Last Updated:** April 9, 2026
**Author:** Senior Backend Architect
**Status:** Production-Ready Documentation
