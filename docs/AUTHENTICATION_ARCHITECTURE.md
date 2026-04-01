# Enterprise Authentication & Authorization Architecture

**Date**: March 29, 2026
**Pattern**: Redux Toolkit + React Router v6
**Focus**: Fetch permissions once, prevent re-fetching on refresh

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    App Component                                 │
│  - usePermissionsInitializer() → Fetch permissions once          │
│  - Check token exists in localStorage                             │
│  - Redirect to login if no token                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  RouterSetup Component                            │
│  - Render static routes (Dashboard, Settings, etc.)              │
│  - Render dynamic routes from Redux (from backend API)           │
│  - Filter routes by user.hasAccess permission                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                ProtectedRoute Component                           │
│  - Check authentication status                                    │
│  - Check permissions loaded                                       │
│  - Check specific permission if required                         │
│  - Show loaders during data fetch                                │
│  - Redirect to login if unauthorized                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Guide

### Step 1: Update Redux Slices

**Routes Slice** (`routes/slice.ts`):
```typescript
✅ Added permissionsLoaded flag to state
✅ Set permissionsLoaded = true on fetchUserRoutes.fulfilled
✅ Reset permissionsLoaded = false on clearRoutes
```

---

### Step 2: Use the Hook in App

**In your App.tsx or main entry point:**

```typescript
import { usePermissionsInitializer } from "@libs-web/web-utils/hooks";
import { RouterSetup } from "@/components/RouterSetup";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export function App() {
  // This hook handles:
  // 1. Check if token exists
  // 2. If token exists AND permissionsLoaded = false → fetch permissions once
  // 3. Never fetch again on page refresh (permissionsLoaded prevents re-fetch)
  usePermissionsInitializer();

  const staticRoutes = [
    {
      path: "/dashboard",
      component: Dashboard,
      label: "Dashboard",
    },
    {
      path: "/settings",
      component: Settings,
      label: "Settings",
      requiredPermission: "settings.view", // Optional: check specific permission
    },
    {
      path: "/admin",
      component: AdminPanel,
      label: "Admin",
      requiredPermission: "admin.access", // Super admin only
    },
  ];

  return (
    <BrowserRouter>
      <RouterSetup routes={staticRoutes} />
    </BrowserRouter>
  );
}
```

---

### Step 3: Understanding Permission Fetching

**First Time Load (User logs in):**
```
1. Login API → returns token only
2. App mounts → usePermissionsInitializer hook runs
3. Hook checks: token exists? YES
4. Hook checks: permissionsLoaded? NO (first time)
5. Hook dispatches: fetchUserRoutes
6. Redux: routes/fetchUserRoutes/fulfilled
7. Routes slice: permissionsLoaded = true
8. Routes now available in ProtectedRoute
```

**Page Refresh (User already logged in):**
```
1. App mounts → usePermissionsInitializer hook runs
2. Hook checks: token exists? YES
3. Hook checks: permissionsLoaded? YES (already loaded)
4. Hook returns early, NO API CALL ✅
5. Routes still available in Redux from cache
```

**User Logs Out:**
```
1. Logout action dispatches clearRoutes
2. Redux: permissionsLoaded = false
3. Routes cleared from Redux
4. Token removed from localStorage
5. Redirect to /login
```

**New Login After Logout:**
```
1. New user logs in
2. New token saved to localStorage
3. App mounts → usePermissionsInitializer hook runs
4. Hook checks: token exists? YES (new token)
5. Hook checks: permissionsLoaded? NO (cleared on logout)
6. Hook dispatches: fetchUserRoutes
7. Routes fetched for new user ✅
```

---

## 🔐 ProtectedRoute Usage Examples

### Basic Protection (Auth Only)
```typescript
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

### Permission-Based Protection
```typescript
<ProtectedRoute requiredPermission="users.view">
  <UsersPage />
</ProtectedRoute>

<ProtectedRoute requiredPermission="stores.manage">
  <StoreManagement />
</ProtectedRoute>

<ProtectedRoute requiredPermission="admin.access">
  <AdminPanel />
</ProtectedRoute>
```

### What ProtectedRoute Does
1. ✅ Checks if user is authenticated
2. ✅ Shows loader while auth initializes
3. ✅ Shows loader while permissions load
4. ✅ Checks specific permission if provided
5. ✅ Shows access denied message if unauthorized
6. ✅ Redirects to login if token missing

---

## 🛣️ RouterSetup Usage

```typescript
<RouterSetup
  routes={staticRoutes}
  fallback={<LoadingSpinner />}
/>
```

**What RouterSetup does:**
1. ✅ Renders static routes (from your config)
2. ✅ Renders dynamic routes (from backend API)
3. ✅ Filters routes by user.hasAccess
4. ✅ Wraps all routes in ProtectedRoute
5. ✅ Shows fallback while loading
6. ✅ Redirects unmatched routes to /dashboard

---

## 🔄 State Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│              localStorage                           │
│  accessToken: "xxx..."                              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│          Auth Slice (Redux)                         │
│  - status: "AUTHENTICATED"                          │
│  - user: { id, name, email, ... }                  │
│  - loginState: { isLoading, hasError, ... }        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│        Routes Slice (Redux)                         │
│  - routes: [ {...}, {...}, ... ]                    │
│  - permissions: [ {...}, {...}, ... ]              │
│  - permissionsLoaded: true ✅                       │
│  - fetchState: { isLoading: false, ... }           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│      Components Access via useSelector              │
│  - useAuth() → token, user, isAuthenticated         │
│  - useRoutes() → routes, permissions, loaded status │
└─────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. **Fetch Permissions Once**
```typescript
// permissionsLoaded flag prevents redundant API calls
if (routesState.permissionsLoaded) {
  // Skip fetch - already loaded in this session
  return;
}
```

### 2. **Automatic Loader**
```typescript
// Show full-page loader while fetching
if (!routesState.permissionsLoaded && routesState.fetchState.isLoading) {
  return <Spinner />;
}
```

### 3. **Permission-Based Access**
```typescript
// Check specific permission before rendering
const hasAccess = routesState.permissions.some(p => p.code === "users.view");
if (!hasAccess) {
  return <AccessDenied />;
}
```

### 4. **Dynamic Routes from Backend**
```typescript
// Backend can add/remove routes without code changes
accessibleBackendRoutes.map(route => (
  <Route key={route.id} path={route.fullPath} element={...} />
))
```

---

## 🚀 Performance Considerations

### Network Requests
- **Login**: 1 API call (token only) ✅
- **Initial Load**: 1 API call (routes/permissions) ✅
- **Page Refresh**: 0 API calls (cached) ✅
- **Permission Change**: 1 API call (manual re-fetch) ✅

### State Management
- Minimal state updates (only when data changes)
- Proper memoization in RouterSetup
- No infinite loops in useEffect hooks

### User Experience
- Full-page loaders during async operations
- Smooth transitions
- Clear error messages
- Automatic redirects to login

---

## 🐛 Debugging

### Check Console Logs
```
[PermissionsInit] Auth still initializing, waiting...
[PermissionsInit] Fetching permissions for first time...
[PermissionsInit] Permissions already loaded, skipping fetch
[RouterSetup] Rendering routes: { staticRoutes: 5, accessibleBackendRoutes: 12 }
[ProtectedRoute] User not authenticated, redirecting to login
[ProtectedRoute] User lacks required permission: users.view
```

### Redux DevTools
1. Open Redux DevTools extension
2. Look for `routes/fetchUserRoutes/fulfilled` action
3. Check `state.routes.permissionsLoaded` is true
4. Verify `state.routes.routes` has content

### Browser DevTools
1. Check `localStorage.accessToken` exists
2. Verify GET `/api/v1/routes/me` request in Network tab
3. Check response has routes and permissions arrays

---

## 📝 Files Created

- ✅ `libs-web/web-utils/src/hooks/usePermissionsInitializer.ts` - Initialization hook
- ✅ `libs-web/web-utils/src/hooks/index.ts` - Export
- ✅ `apps/nks-web/src/components/ProtectedRoute.tsx` - Route protection
- ✅ `apps/nks-web/src/components/RouterSetup.tsx` - Dynamic routing

## 📦 Files Modified

- ✅ `libs-common/state-manager/.../routes/model.ts` - Added permissionsLoaded flag
- ✅ `libs-common/state-manager/.../routes/slice.ts` - Updated handlers
- ✅ `libs-web/web-utils/src/index.ts` - Export hooks

---

## ✅ Testing Checklist

- [ ] User logs in → routes fetched once
- [ ] Page refresh → no additional API call
- [ ] User logs out → permissions cleared
- [ ] New login → permissions fetched for new user
- [ ] Protected route without auth → redirects to login
- [ ] Protected route with missing permission → shows access denied
- [ ] Dynamic routes → rendered from backend data
- [ ] Navigation → works smoothly without lag
- [ ] Error handling → shows error messages appropriately
- [ ] Loading states → spinners show during fetch

---

## 🎓 Architecture Principles

1. **Single Responsibility**
   - Each component has one job
   - Each slice manages one domain

2. **DRY (Don't Repeat Yourself)**
   - usePermissionsInitializer is called once per app
   - ProtectedRoute handles all auth checks

3. **Scalability**
   - Add routes by updating staticRoutes array
   - Backend can add/remove routes dynamically
   - New permissions work without code changes

4. **Maintainability**
   - Clear separation of concerns
   - Well-documented with examples
   - Easy to test each component

5. **Performance**
   - Fetch permissions once, cache thereafter
   - Proper memoization prevents re-renders
   - No redundant API calls

---

## 🔗 Related Files

- `ROUTES_INTEGRATION_FIX.md` - Redux handlers for routes
- `ROUTES_TESTING_GUIDE.md` - How to test the integration
- `SESSION_COMPLETION_SUMMARY.md` - Overall progress summary

