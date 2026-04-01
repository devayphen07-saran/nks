# Auth Integration Guide

This document explains how the authentication system is integrated between the mobile app, backend, and local WatermelonDB.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  MOBILE APP                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Components/Screens                                     │
│  ├─ OtpScreen.tsx → calls verifyOtp()                  │
│  ├─ LoginScreen.tsx → calls login()                    │
│  └─ Dashboard → uses useAccessToken()                  │
│                                                         │
│  Redux Store                                            │
│  ├─ authSlice.ts → auth state (redux state)            │
│  ├─ persistLogin() → saves to Redux + LocalDB          │
│  ├─ logoutUser() → clears Redux + LocalDB              │
│  └─ initializeAuth() → restores from Redux + LocalDB   │
│                                                         │
│  Local Database (WatermelonDB)                          │
│  ├─ auth_users → user profile                          │
│  ├─ auth_sessions → tokens + expiry                    │
│  ├─ auth_roles → user roles per store                  │
│  └─ auth_flags → feature flags                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Login Flow

```
1. User enters OTP → OtpScreen.tsx
2. Call verifyOtp(phone, otp, reqId) to backend
3. Backend returns AuthResponse:
   {
     user: { id, name, email, ... },
     session: { accessToken, refreshToken, expiresAt, ... },
     access: { roles: [], isSuperAdmin, ... },
     flags: { FEATURE_X: true, ... }
   }

4. Call persistLogin(authResponse, dispatch):
   ├─ tokenManager.set(accessToken)               // In-memory
   ├─ tokenManager.persistSession(authResponse)   // SecureStorage
   ├─ dispatch(setCredentials(authResponse))      // Redux
   └─ Save to LocalDB:
      ├─ auth_users.create()
      ├─ auth_sessions.create()
      ├─ auth_roles.create() × roles.length
      └─ auth_flags.create() × flags.length

5. Navigate to Dashboard
```

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `store/persistLogin.ts` | Saves auth response to Redis + LocalDB after login |
| `store/tokenRefreshService.ts` | Handles token refresh logic |
| `store/logoutUser.ts` | Clears auth from Redux + LocalDB on logout |
| `store/initializeAuth.ts` | Restores auth on app startup |
| `hooks/useLocalAuth.ts` | React hooks for local auth data access |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Added `@nks/local-db` dependency |
| `store/persistLogin.ts` | Added LocalDB save logic |
| `store/initializeAuth.ts` | Added LocalDB initialization |

## Usage in Components

### Basic Auth Check

```typescript
import { useAuthGuard } from "../utils/auth-provider";

export function Dashboard() {
  const { isLoggedIn, isLoading } = useAuthGuard();

  if (isLoading) return <LoadingScreen />;
  if (!isLoggedIn) return <RedirectToLogin />;

  return <DashboardContent />;
}
```

### Get Access Token

```typescript
import { useAccessToken } from "../hooks/useLocalAuth";

export function MyComponent() {
  const { token, loading } = useAccessToken();

  if (loading) return <Loading />;

  // Use token for API calls
  const data = await fetch("/api/data", {
    headers: { Authorization: `Bearer ${token}` }
  });

  return <div>{data}</div>;
}
```

### Check Token Status

```typescript
import { useTokenRefreshStatus } from "../hooks/useLocalAuth";

export function Header() {
  const { needsRefresh, isExpired } = useTokenRefreshStatus();

  if (isExpired) {
    return <Text>Session expired. Please login again.</Text>;
  }

  if (needsRefresh) {
    return <Text style={{ color: 'orange' }}>Session expiring soon</Text>;
  }

  return <Text>Session active</Text>;
}
```

### Check User Role

```typescript
import { useRole } from "../hooks/useLocalAuth";

export function StoreMenu() {
  const { hasRole } = useRole();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const owner = await hasRole("STORE_OWNER", storeId);
      setIsOwner(owner);
    })();
  }, []);

  return (
    <>
      {isOwner && <MenuItem title="Manage Staff" />}
      <MenuItem title="View Orders" />
    </>
  );
}
```

### Logout

```typescript
import { useRootDispatch } from "../store";
import { performLogout } from "../store/logoutUser";

export function Settings() {
  const dispatch = useRootDispatch();

  const handleLogout = async () => {
    await performLogout(dispatch);
    // Navigation will automatically redirect to login
  };

  return <Button onPress={handleLogout}>Sign Out</Button>;
}
```

## Token Refresh Flow

```
Before any API request:
├─ ensureValidToken()
│  ├─ Check: is token expired?
│  │  └─ Yes → POST /auth/refresh
│  │     ├─ Send: refreshToken
│  │     ├─ Get: new accessToken, refreshToken
│  │     └─ Update: auth_sessions with new tokens
│  │
│  └─ Check: does token expire in < 5 min?
│     └─ Yes → proactively refresh (in background)
│
└─ Return: valid accessToken
```

## Local Database Tables

### auth_users
```typescript
{
  id: string;
  user_id: number;          // Backend user ID
  name: string;
  email?: string;
  phone_number?: string;
  image?: string;
  is_super_admin: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: number;
  updated_at: number;
  last_login_at?: number;
}
```

### auth_sessions
```typescript
{
  id: string;
  user_id: number;
  session_id: string;
  access_token: string;     // JWT
  refresh_token: string;    // Opaque
  token_type: string;       // "Bearer"
  access_expires_at: number; // Timestamp in ms
  refresh_expires_at: number;
  absolute_expiry: number;  // Hard session limit
  is_active: boolean;
  mechanism: string;        // 'otp', 'password', 'oauth'
  created_at: number;
  last_used_at?: number;
}
```

### auth_roles
```typescript
{
  id: string;
  user_id: number;
  store_id?: number;        // null = global role
  role_code: string;        // 'CUSTOMER', 'STORE_OWNER', etc.
  role_name: string;
  permissions: string;      // JSON array
  is_active: boolean;
  created_at: number;
  updated_at: number;
}
```

### auth_flags
```typescript
{
  id: string;
  flag_code: string;
  flag_name: string;
  is_enabled: boolean;
  value?: string;           // Config value if needed
  created_at: number;
  updated_at: number;
}
```

## API Integration Points

### 1. Login/OTP Verification
```typescript
// In OtpScreen.tsx
const result = await dispatch(verifyOtp({
  bodyParam: { phone, otp, reqId }
}));

if (verifyOtp.fulfilled.match(result)) {
  await persistLogin(result.payload.data, dispatch);
  // LocalDB is now populated
}
```

### 2. Token Refresh
```typescript
// In axios interceptor or before requests
const token = await ensureValidToken();
// If token was expired, it's now refreshed from refresh_token
// auth_sessions is updated with new token
```

### 3. Logout
```typescript
const dispatch = useRootDispatch();
await performLogout(dispatch);
// All auth tables in LocalDB are cleared
// Redux state is reset
// Navigation redirects to login
```

## Offline Support

All auth data is stored locally, so:
- User profile available offline ✓
- Roles/permissions available offline ✓
- Token stored locally (can make authenticated requests if offline) ✓
- Token refresh requires network (fails gracefully) ✗

When offline:
1. Can view cached user profile
2. Can view cached roles/permissions
3. Token refresh will fail → continue with stale token if not expired
4. Once online, proactive refresh happens automatically

## Error Handling

### Token Expired
- If both access + refresh tokens expired
- User must login again
- All local auth data is cleared
- Navigate to login screen

### Network Error During Login
- persistLogin fails gracefully
- Token is still in memory
- User can retry or continue (app may restart and need login)

### LocalDB Initialization Fails
- Warning logged but not critical
- App continues with in-memory tokens only
- User will be logged out on app restart

## Performance Notes

- LocalDB queries are synchronous (RxJS observables)
- useLocalAuth() hooks are optimized with useEffect + useState
- Token refresh happens in background before expiry
- No blocking on UI thread for DB operations

## Security Notes

- Tokens stored in SQLite (encrypted by OS for mobile)
- Access token has 1-hour expiry
- Refresh token has 7-day expiry
- Tokens cleared on logout
- Session ID used to track active sessions
- isSuperAdmin flag prevents privilege escalation
