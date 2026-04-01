# Admin Routes Implementation - Frontend

## ✅ What Was Implemented

### 1. Updated Routes Configuration
**File**: `/src/config/routes.ts`

**Added routes**:
- `SELECT_STORE: "/select-store"` - Store selection page for regular users
- `ADMIN_DASHBOARD: "/admin/dashboard"` - Admin dashboard for SUPER_ADMIN
- `ADMIN_ROUTES: "/admin/routes"` - (for future use)
- `ADMIN_PERMISSIONS: "/admin/permissions"` - (for future use)

**Updated route arrays**:
- Added `SELECT_STORE` to `AUTH_ROUTES` (accessible without full auth)
- Added admin routes to `PROTECTED_ROUTES`

---

### 2. Updated Login Flow
**File**: `/src/app/(auth)/login/page.tsx`

**Changes**:
- Extract `isSuperAdmin` from login response: `authData?.access?.isSuperAdmin`
- Conditional redirect based on role:
  ```typescript
  if (isSuperAdmin) {
    router.push(ROUTES.ADMIN_DASHBOARD);
  } else {
    router.push(ROUTES.SELECT_STORE);
  }
  ```

**Flow**:
```
Login successful
    ↓
Check isSuperAdmin flag from response
    ↓
├─ TRUE  → Redirect to /admin/dashboard
└─ FALSE → Redirect to /select-store
```

---

### 3. Admin Dashboard Page
**Files**:
- `/src/app/admin/dashboard/page.tsx` - Server Component with AdminGuard
- `/src/app/admin/dashboard/_components/admin-dashboard-client.tsx` - Client Component

**Features**:
- ✅ Protected by `AdminGuard` (requires SUPER_ADMIN role)
- ✅ Fetches `GET /auth/admin/routes-permissions` on mount
- ✅ Displays routes grouped by type (screen, sidebar, modal)
- ✅ Displays permissions grouped by resource
- ✅ Shows loading state with spinner
- ✅ Shows error state with retry button
- ✅ Summary stats (total routes, permissions, resources)
- ✅ Clickable links to navigate to routes

**Data Structure**:
```typescript
interface RouteItem {
  id: number;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: "screen" | "sidebar" | "modal" | "tab";
  sortOrder: number;
  parentRouteFk?: number | null;
}

interface PermissionItem {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}
```

**API Call**:
```typescript
const response = await API.get<AdminRoutesPermissionsResponseDto>(
  "/auth/admin/routes-permissions"
);
```

---

### 4. Store Selection Page
**Files**:
- `/src/app/select-store/page.tsx` - Server Component
- `/src/app/select-store/_components/select-store-client.tsx` - Client Component

**Features**:
- ✅ Placeholder UI for regular users to select a store
- ✅ Redirects SUPER_ADMIN users to admin dashboard
- ✅ Redirects authenticated users with activeStoreId to dashboard
- ✅ Shows user's name in welcome message
- ✅ Shows loading state while auth is initializing

**Next Phase (TODO)**:
- Fetch user's stores (owned + invited)
- Display store cards
- Handle store selection
- Fetch store-specific routes/permissions

---

## 📊 Complete User Journey

### SUPER_ADMIN Flow:
```
1. Login Page
   └─ Email + Password

2. Backend: POST /auth/login
   └─ Response: { isSuperAdmin: true, ... }

3. Frontend: LoginPage checks isSuperAdmin
   └─ Redirect to /admin/dashboard

4. Admin Dashboard
   └─ Fetch GET /auth/admin/routes-permissions
   └─ Display routes and permissions
   └─ User can navigate to any route
```

### Regular User Flow:
```
1. Login Page
   └─ Email + Password

2. Backend: POST /auth/login
   └─ Response: { isSuperAdmin: false, activeStoreId: null, ... }

3. Frontend: LoginPage checks isSuperAdmin
   └─ Redirect to /select-store

4. Store Selection Page
   └─ Show available stores (to be implemented)
   └─ User selects a store
   └─ POST /auth/store/select { storeId }
   └─ Redirect to /dashboard

5. Dashboard
   └─ Fetch GET /store/:id/routes-permissions (to be implemented)
   └─ Display store-specific routes
```

---

## 🔐 Guards Applied

### AdminGuard
- Location: `@libs-web/web-utils/guards`
- Checks: `user?.access?.isSuperAdmin === true`
- Fallback: Redirects to `/dashboard`
- Used in: `/admin/dashboard`

### AppGuard
- Checks: `isAuthenticated === true`
- Used in: Protected routes in (dashboard) group

---

## 📝 Authentication State Integration

**Auth State from Redux** (`@nks/state-manager`):
```typescript
interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  access: {
    isSuperAdmin: boolean;        // ← Used for routing decision
    activeStoreId: number | null; // ← Used to check if store selected
    roles: UserRoleEntry[];
  };
}
```

**Accessed in components via**:
```typescript
const { user, isAuthenticated, isSuperAdmin } = useAuth();
```

---

## 🧪 Testing the Implementation

### Test as SUPER_ADMIN:

1. **Login**:
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "super@admin.com",
     "password": "password123"
   }
   ```

2. **Check Response**:
   - Should contain: `"isSuperAdmin": true`
   - Should contain: `"activeStoreId": null`

3. **Navigate to Admin Dashboard**:
   - Should redirect to: `/admin/dashboard`
   - Should display routes and permissions from backend

### Test as Regular User:

1. **Login**:
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "user@store.com",
     "password": "password123"
   }
   ```

2. **Check Response**:
   - Should contain: `"isSuperAdmin": false`
   - Should contain: `"activeStoreId": null` (until store selected)

3. **Navigate to Store Selection**:
   - Should redirect to: `/select-store`
   - Should show welcome message

---

## 📋 Files Created/Modified

### Created:
- ✅ `/src/app/admin/dashboard/page.tsx`
- ✅ `/src/app/admin/dashboard/_components/admin-dashboard-client.tsx`
- ✅ `/src/app/select-store/page.tsx`
- ✅ `/src/app/select-store/_components/select-store-client.tsx`

### Modified:
- ✅ `/src/config/routes.ts` - Added new routes
- ✅ `/src/app/(auth)/login/page.tsx` - Added isSuperAdmin check and conditional redirect

---

## 🎯 Next Steps (Phase 2)

### For Regular Users:
1. **Implement store list display** in `/select-store`
   - Fetch GET `/store/my-stores` (owned stores)
   - Fetch GET `/store/invited` (invited/staff stores)
   - Display store cards with role badges

2. **Implement store selection**
   - POST `/auth/store/select { storeId }`
   - Update Redux with new activeStoreId
   - Redirect to `/dashboard`

3. **Implement store-specific routes page**
   - Create GET `/store/:id/routes-permissions` endpoint (backend)
   - Fetch and display store-specific routes
   - Filter routes by user's role/permissions

### For Admin Dashboard:
1. **Add dynamic navigation** based on fetched routes
2. **Implement route details page**
3. **Implement permission assignment UI**
4. **Add role management interface**

---

## ✅ Implementation Checklist

Following NEXTJS_WEB_AGENT.md:

- [x] Used App Router only (app/ directory)
- [x] Server Components by default (AdminGuard wraps page)
- [x] Co-located components in `_components/`
- [x] Proper TypeScript types from `@nks/api-manager`
- [x] Redux state via `useAuth()`
- [x] No hardcoded values (using useAuth for user data)
- [x] Proper imports from shared libraries
- [x] Client components marked with `'use client'`
- [x] Loading and error states handled
- [x] Guards applied correctly
- [x] No localStorage access (via auth-provider)
- [x] Proper route protection with guards

---

## 🔗 Related Backend APIs

- **POST `/auth/login`** - Login endpoint (returns isSuperAdmin)
- **GET `/auth/admin/routes-permissions`** - Fetch admin routes/permissions (SUPER_ADMIN only)
- **GET `/store/my-stores`** - Fetch user's owned stores (to be integrated)
- **GET `/store/invited`** - Fetch user's invited stores (to be integrated)
- **POST `/auth/store/select`** - Select a store and get updated access (to be integrated)
- **GET `/store/:id/routes-permissions`** - Fetch store-specific routes/permissions (to be created)

---

## 🚀 Quick Start

### Test Admin Dashboard:
1. Login with SUPER_ADMIN email
2. Should auto-redirect to `/admin/dashboard`
3. Should see routes and permissions displayed
4. Can click routes to navigate (if route exists)

### Test Store Selection (coming soon):
1. Login with regular user email
2. Should auto-redirect to `/select-store`
3. Will see store list (to be implemented)

