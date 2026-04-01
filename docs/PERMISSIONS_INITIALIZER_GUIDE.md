# Permissions Initializer Hook - Multi-Platform Guide

**Created**: March 29, 2026
**Pattern**: React/React Native Hooks
**Purpose**: Fetch permissions once on app load, prevent re-fetching on page/screen refresh

---

## 📍 Hook Locations

### Web
```
/Users/saran/ayphen/projects/nks/libs-web/web-utils/src/hooks/usePermissionsInitializer.ts
/Users/saran/ayphen/projects/nks/libs-common/web-utils/src/hooks/usePermissionsInitializer.ts
```

**Import:**
```typescript
// From libs-web (web-specific)
import { usePermissionsInitializer } from '@libs-web/web-utils/hooks';

// From libs-common (shared)
import { usePermissionsInitializer } from '@nks/web-utils/hooks';
```

### Mobile
```
/Users/saran/ayphen/projects/nks/apps/nks-mobile/src/hooks/usePermissionsInitializer.ts
```

**Import:**
```typescript
import { usePermissionsInitializer } from '@/hooks';
// or
import { usePermissionsInitializer } from '../src/hooks';
```

---

## 🎯 What It Does

### Logic Flow
```
App Mount
  ↓
Is Auth Status "INITIALIZING"?
  ├─ YES → Wait (return early)
  └─ NO → Continue
  ↓
Does Token Exist?
  ├─ NO → Skip (return early)
  └─ YES → Continue
  ↓
Are Permissions Already Loaded?
  ├─ YES → Skip (return early) ✅
  └─ NO → Continue
  ↓
Is Fetch Already In Progress?
  ├─ YES → Wait (return early)
  └─ NO → Continue
  ↓
Dispatch fetchUserRoutes({})
  ↓
Redux: routes.permissionsLoaded = true ✅
```

---

## 💻 Web Usage

### In your App.tsx
```typescript
import { usePermissionsInitializer } from '@libs-web/web-utils/hooks';
import { RouterSetup } from '@/components/RouterSetup';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export function App() {
  // Call this once at the app root level
  usePermissionsInitializer();

  const staticRoutes = [
    {
      path: '/dashboard',
      component: Dashboard,
      label: 'Dashboard',
    },
    {
      path: '/users',
      component: Users,
      label: 'Users',
      requiredPermission: 'users.view',
    },
  ];

  return (
    <BrowserRouter>
      <RouterSetup routes={staticRoutes} />
    </BrowserRouter>
  );
}
```

**What happens:**
1. App mounts → `usePermissionsInitializer()` runs
2. Checks token in localStorage
3. If token exists and permissions not loaded → fetches routes
4. Sets `permissionsLoaded = true` in Redux
5. Page refresh → hook skips fetch (flag prevents re-fetch) ✅
6. New login → flag resets, fetch happens again ✅

---

## 📱 Mobile Usage

### In your App.tsx (root component)
```typescript
import { usePermissionsInitializer } from '@/hooks';
import { AppNavigator } from '@/navigation/AppNavigator';

export default function App() {
  // Call this once at the app root level
  usePermissionsInitializer();

  return (
    <AppLayout>
      <AppNavigator />
    </AppLayout>
  );
}
```

### Or in a specific screen/layout
```typescript
import { usePermissionsInitializer } from '@/hooks';

export default function DashboardScreen() {
  // Call at screen level if not called in root
  usePermissionsInitializer();

  return (
    <View>
      {/* Screen content */}
    </View>
  );
}
```

**What happens:**
1. App loads → `usePermissionsInitializer()` runs
2. Checks token in AsyncStorage
3. If token exists and permissions not loaded → fetches routes
4. Sets `permissionsLoaded = true` in Redux
5. Screen navigation → hook skips fetch (flag prevents re-fetch) ✅
6. New login → flag resets, fetch happens again ✅

---

## 🔄 State Management

### Redux State
```typescript
// Before fetch
routes: {
  routes: [],
  permissions: [],
  permissionsLoaded: false,  // ← Initial state
  fetchState: { isLoading: false }
}

// During fetch
routes: {
  routes: [],
  permissions: [],
  permissionsLoaded: false,  // Still false
  fetchState: { isLoading: true }  // ← Loading
}

// After fetch
routes: {
  routes: [{ ... }, { ... }],
  permissions: [{ ... }],
  permissionsLoaded: true,   // ← Marked as loaded
  fetchState: { isLoading: false }
}
```

### On Logout
```typescript
// clearRoutes action resets everything
routes: {
  routes: [],
  permissions: [],
  permissionsLoaded: false,  // ← Reset for next login
  fetchState: { isLoading: false }
}
```

---

## 🧪 Testing the Hook

### Web - Check Console
```
Open DevTools (F12) → Console tab

Expected logs:
[PermissionsInit] Auth still initializing, waiting...
[PermissionsInit] Fetching permissions for first time...
[PermissionsInit] Permissions already loaded, skipping fetch
```

### Web - Check Network
```
Open DevTools → Network tab
Look for: GET /api/v1/routes/me
- Should appear once on first load
- Should NOT appear on page refresh
- Should appear again after fresh login
```

### Mobile - Check Console
```
Open React Native debugger or Xcode console

Expected logs:
[PermissionsInit] Auth still initializing, waiting...
[PermissionsInit] Fetching permissions for first time...
[PermissionsInit] Permissions already loaded, skipping fetch
```

### Redux DevTools
```
Both platforms:
1. Look for action: "routes/fetchUserRoutes/fulfilled"
2. Check state.routes.permissionsLoaded = true
3. Verify state.routes.routes has content
```

---

## ⚙️ Configuration

### Enable/Disable Logging
To reduce console noise in production:

```typescript
// In usePermissionsInitializer.ts
const DEBUG = __DEV__; // Mobile
// const DEBUG = process.env.NODE_ENV === 'development'; // Web

if (DEBUG) {
  console.log('[PermissionsInit] Auth still initializing, waiting...');
}
```

### Customize Fetch Parameters
```typescript
// Default: dispatch(fetchUserRoutes({}))

// With parameters:
dispatch(fetchUserRoutes({
  appCode: 'NKS_WEB',
  // other params
}));
```

---

## 🚀 Best Practices

### 1. Call at App Root Level
```typescript
// ✅ GOOD - Call once
export default function App() {
  usePermissionsInitializer();
  return <AppContent />;
}

// ❌ BAD - Don't call in every component
export function Dashboard() {
  usePermissionsInitializer(); // This runs on every render!
  return <Content />;
}
```

### 2. Don't Manually Re-fetch on Mount
```typescript
// ❌ AVOID - Hook already handles this
useEffect(() => {
  dispatch(fetchUserRoutes());
}, []);

// ✅ Good - Let the hook manage it
usePermissionsInitializer();
```

### 3. Handle Loading States in Components
```typescript
// ✅ GOOD - Show loader
const { permissionsLoaded, fetchState } = useSelector(state => state.routes);

if (!permissionsLoaded && fetchState.isLoading) {
  return <Spinner />;
}

return <Content />;
```

---

## 🐛 Troubleshooting

### Problem: Permissions fetching on every page load
**Solution**: Hook is being called in multiple components. Move it to root only.

### Problem: Permissions not showing after login
**Solution**: Check if `permissionsLoaded` flag is in Redux state. Verify `fetchUserRoutes` handlers exist in routes slice.

### Problem: Hook not called after app update
**Solution**: Clear app cache:
- **Web**: Clear localStorage + browser cache
- **Mobile**: Reinstall app

### Problem: Network request shows 401
**Solution**: Token is missing or expired. User needs to login again.

---

## 📊 Performance Impact

### Network Requests
| Scenario | Requests |
|----------|----------|
| First load | 1 ✅ |
| Page refresh | 0 ✅ |
| Navigation | 0 ✅ |
| New login | 1 ✅ |
| Admin role change | 1 (manual re-fetch) ✅ |

### Bundle Size
- Hook: ~2KB minified
- No additional dependencies
- Minimal performance impact

---

## 🔗 Related Components

### Web
- `ProtectedRoute.tsx` - Route-level protection
- `RouterSetup.tsx` - Dynamic route rendering
- `AUTHENTICATION_ARCHITECTURE.md` - Full web architecture

### Mobile
- `useActiveStoreRole.ts` - Get current role
- `StoreDrawerContent.tsx` - Role-based drawer
- `AccountTypeScreen.tsx` - Account selection

---

## ✅ Implementation Checklist

- [ ] Hook imported in app root
- [ ] Called once at startup
- [ ] Redux state has `permissionsLoaded` flag
- [ ] `fetchUserRoutes` handlers exist in routes slice
- [ ] Logout clears `permissionsLoaded` flag
- [ ] Console logs show correct flow
- [ ] Network tab shows single request on load
- [ ] Page refresh doesn't trigger new request
- [ ] New login triggers new request
- [ ] Components check `permissionsLoaded` before rendering

---

## 📝 File Summary

| Path | Purpose |
|------|---------|
| `libs-web/web-utils/src/hooks/usePermissionsInitializer.ts` | Web implementation |
| `libs-common/web-utils/src/hooks/usePermissionsInitializer.ts` | Shared implementation |
| `apps/nks-mobile/src/hooks/usePermissionsInitializer.ts` | Mobile implementation |
| `PERMISSIONS_INITIALIZER_GUIDE.md` | This guide |

---

## 🎓 How It Differs from Protected Routes

| Aspect | usePermissionsInitializer | ProtectedRoute |
|--------|-------------------------|----------------|
| **Purpose** | Fetch permissions once | Check permissions per route |
| **Level** | App-wide, called once | Per-route, called per navigation |
| **Timing** | On mount | On navigation |
| **Data** | Loads routes/permissions | Uses loaded data |
| **State** | Sets `permissionsLoaded` flag | Reads `permissionsLoaded` flag |

**Together they form a complete system:**
1. Hook fetches permissions once
2. ProtectedRoute checks them on every access
3. No redundant API calls ✅

