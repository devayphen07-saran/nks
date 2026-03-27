# Mobile Auth Flow Summary

## Quick Reference

### 1️⃣ Login Screen
**Purpose:** User enters phone and verifies OTP

```
Step 1: Enter Phone Number
  └─ POST /auth/otp/send { phone }
     Response: { requestId, message }

Step 2: Enter OTP
  └─ POST /auth/otp/verify { phone, otp, reqId }
     Response: {
       user: { id, name, email, phoneNumber, ... },
       token: "jwt_token",
       access: {
         roles: [...],
         permissions: [...],
         isSuperAdmin: false,
         activeStoreId: null,
         userType: "PERSONAL" | "STAFF" | ...
       }
     }
```

**Redux State After Login:**
- `auth.user` = UserInfo
- `auth.token` = JWT token
- `auth.isAuthenticated` = true

---

### 2️⃣ Profile Completion Check

**After login, check user profile:**

```typescript
const { user } = useBaseStoreSelector(state => state.auth);

// Check if profile is complete
const isProfileComplete = user?.user.emailVerified &&
                         user?.user.email != null;

if (!isProfileComplete) {
  // Show ProfileCompletionScreen
} else {
  // Go to StoreSelectionScreen
}
```

---

### 3️⃣ Profile Completion Screen
**Purpose:** Add secondary auth method (email+password)

```
User logged in via PHONE → needs EMAIL + PASSWORD

Input:
  - name: "John Doe"
  - email: "john@example.com"
  - password: "SecurePass123!"

POST /auth/profile/complete {
  name: string,
  email: string,
  password: string
}

Response: {
  emailVerificationSent: true,
  phoneVerificationSent: false,
  nextStep: "verifyEmail",
  message: "OTP sent. Please verify your email"
}
```

**Next Step:**
- If `nextStep === "verifyEmail"` → Show email OTP verification
- If `nextStep === "complete"` → Skip to StoreSelectionScreen

---

### 4️⃣ Email Verification (Optional)

**If email was added in profile completion:**

```
POST /auth/otp/email/verify {
  email: "john@example.com",
  otp: "123456"
}

Response: { message: "Email verified successfully" }
```

**After Email Verification:**
- User can now use email + password to login
- Profile is now complete
- Proceed to StoreSelectionScreen

---

### 5️⃣ Store Selection Screen
**Purpose:** User selects which store to access

```
GET /stores
Response: {
  items: [
    {
      id: 1,
      name: "Main Store",
      city: "Mumbai",
      address: "...",
      phoneNumber: "..."
    },
    {
      id: 2,
      name: "Branch Store",
      city: "Delhi",
      address: "...",
      phoneNumber: "..."
    }
  ],
  total: 2,
  page: 1,
  pageSize: 20
}

When user clicks a store:
POST /auth/store/select { storeId: 1 }

Response: {
  roles: [
    {
      roleCode: "STAFF",
      storeId: 1,
      storeName: "Main Store"
    }
  ],
  permissions: ["create_order", "view_inventory", ...],
  isSuperAdmin: false,
  activeStoreId: 1,
  userType: "STAFF"
}
```

**Redux State After Store Selection:**
- `auth.user.access.activeStoreId` = 1 (selected store)
- `auth.user.access.permissions` = updated permissions for store
- Ready to navigate to StoreDashboard

---

## Endpoint Checklist

| Endpoint | Method | Auth | Used When |
|----------|--------|------|-----------|
| `/auth/otp/send` | POST | ❌ | Send OTP to phone |
| `/auth/otp/verify` | POST | ❌ | Verify phone OTP & login |
| `/auth/get-session` | GET | ✅ | Validate token, refresh user data |
| `/auth/profile/complete` | POST | ✅ | Add email+password or phone after login |
| `/auth/otp/email/verify` | POST | ✅ | Verify email OTP (if added in profile) |
| `/auth/store/select` | POST | ✅ | Select active store |
| `/stores` | GET | ✅ | List all stores user has access to |
| `/stores/{storeId}` | GET | ✅ | Get store details |

---

## Screen Decision Tree

```
┌─────────────────────────┐
│  App Loads              │
└────────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ Check localStorage  │
    │ for JWT token       │
    └────────┬────────────┘
             │
      ┌──────┴──────┐
      │             │
      NO           YES
      │             │
      │             ▼
      │      ┌──────────────────────┐
      │      │ Verify token still   │
      │      │ valid                │
      │      │ GET /auth/get-session│
      │      └─────┬────────────────┘
      │            │
      │       ┌────┴────┐
      │       │ VALID?  │
      │       └────┬────┘
      │            │
      │         YES│ NO
      │            │  └──────────┐
      ▼            ▼             ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │  Login   │ │ Check    │ │  Login   │
 │ Screen   │ │ Profile  │ │ Screen   │
 │ (OTP)    │ │ Complete?│ │          │
 └─┬────────┘ └────┬─────┘ └──────────┘
   │               │
   └────────┬──────┘
            │
            ▼
   ┌─────────────────┐
   │ Profile         │
   │ Complete?       │
   └────────┬────────┘
            │
        ┌───┴───┐
        │       │
       NO      YES
        │       │
        ▼       ▼
    ┌────┐ ┌──────────────┐
    │Add │ │ Store        │
    │Pro-│ │ Selection    │
    │fil │ │ Screen       │
    └──┬─┘ └──────┬───────┘
       │          │
       └────┬─────┘
            │
            ▼
    ┌────────────────┐
    │ Store          │
    │ Dashboard /    │
    │ List Page      │
    └────────────────┘
```

---

## State Management Pattern

### Redux (Part A) - Global Auth State
```typescript
interface AuthSliceState {
  // API States (loading, error)
  sendOtpState: APIState
  verifyOtpState: APIState
  profileCompleteState: APIState
  storeSelectState: APIState

  // Current User
  user: AuthResponse | null
  token: string | null
  isAuthenticated: boolean
}
```

### TanStack Query (Part B) - Store List
```typescript
useStores(params?: {
  page?: number,
  pageSize?: number,
  search?: string
})
// Caches store list, auto-refetch on stale
// No need to manage manually
```

---

## Component Props Flow

```
App Root
  ├─ useSelector(auth) → { user, token, isAuthenticated }
  │
  ├─ if (!isAuthenticated)
  │  └─ <LoginScreen />
  │
  ├─ if (!user.profileCompleted)
  │  └─ <ProfileCompletionScreen onComplete={() => setShowStores(true)} />
  │
  └─ <StoreSelectionScreen
       stores={useStores().data}
       onSelectStore={(storeId) => {
         dispatch(storeSelect({ storeId }))
         navigate('/store/dashboard')
       }}
     />
```

---

## Error Handling

| Error | Where | Solution |
|-------|-------|----------|
| Invalid OTP | LoginScreen | Show error, let user retry |
| Phone already exists | LoginScreen | Ask to login with existing account |
| Weak password | ProfileCompletionScreen | Validate before send (12+ chars, uppercase, lowercase, number, special) |
| Email already in use | ProfileCompletionScreen | Show error, ask to use different email |
| No stores available | StoreSelectionScreen | Show message: "Contact admin to be assigned a store" |
| Token expired | Any screen | Clear localStorage, redirect to LoginScreen |
| Network error | Any screen | Show retry button, use offline-first caching |

---

## Storage (Mobile)

```typescript
// AsyncStorage (React Native) / localStorage (Web)

// After successful login:
await AsyncStorage.setItem('auth_token', token)
await AsyncStorage.setItem('auth_user', JSON.stringify(user))

// On app launch:
const token = await AsyncStorage.getItem('auth_token')
if (token) {
  // Validate with GET /auth/get-session
  dispatch(getSession())
}

// On logout:
await AsyncStorage.removeItem('auth_token')
await AsyncStorage.removeItem('auth_user')
```

