# Routes & Permissions Architecture — NKS

This document covers the complete Routes & Permissions setup: API layer, state management, caching strategy, dispatch patterns, and component integration following the Part A pattern.

---

## 1. Overview

The Routes & Permissions system fetches role-specific navigation routes and user permissions once per session and caches them in Redux. It is split across three packages:

| Package | Role |
|---|---|
| `@nks/api-manager` | API endpoints, request/response types, async thunks |
| `@nks/state-manager` | Redux slice, caching logic, typed hooks |
| `@nks/web` | Component integration, layout rendering, sidebar/dashboard |

**Key Design Decision:** Routes are **session-scoped cached** — fetched once after login, reused across navigations, cleared on logout.

---

## 2. Store Setup

### 2a. Base Store (`libs-common/state-manager/src/lib/base-reducer.ts`)

The routes slice is integrated into the shared base store alongside auth, company, and user-profile slices.

```ts
// base-reducer.ts
import { routesSlice } from "./shared-slice/routes/slice";

export const baseReducer = {
  auth: authSlice.reducer,
  store: storeSlice.reducer,
  routes: routesSlice.reducer,
  userProfile: userProfileSlice.reducer,
};

export const baseStore = configureStore({
  reducer: baseReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "auth/login/fulfilled",
          "auth/register/fulfilled",
          "routes/fetchRoutesAndPermissions/fulfilled",
          // ...
        ],
      },
    }),
});

export type BaseStoreRootState = ReturnType<typeof baseStore.getState>;
export type BaseStoreDispatch = typeof baseStore.dispatch;

export const useBaseStoreDispatch = () => useDispatch<BaseStoreDispatch>();
export const useBaseStoreSelector: TypedUseSelectorHook<BaseStoreRootState> = useSelector;
```

### 2b. Store State Shape

```
BaseStoreRootState {
  auth: AuthState
  store: StoreState
  routes: RoutesState          ← NEW
  userProfile: UserProfileState
}
```

---

## 3. API Layer

### 3a. Types & Models (`libs-common/api-manager/src/lib/routes/request-dto.ts`)

```ts
export interface Route {
  id: number;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: string;          // e.g., "admin", "store", "shared"
  fullPath?: string;          // computed full path with parent routes
  sortOrder?: number;
  parentRouteFk?: number | null;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;           // e.g., "user", "store", "order"
  action: string;             // e.g., "read", "write", "delete"
  description?: string | null;
}

export interface RoutesAndPermissionsData {
  routes: Route[];
  permissions: Permission[];
}

export interface RoutesAndPermissionsResponse {
  // Standard API response wrapper (ApiResponse<RoutesAndPermissionsData>)
  statusCode: number;
  message: string;
  data: RoutesAndPermissionsData;
}

export interface FetchRoutesRequest {
  // Empty interface — both endpoints take no request body
}
```

### 3b. API Endpoints (`libs-common/api-manager/src/lib/routes/api-data.ts`)

```ts
import { APIData, APIMethod } from "../api-handler";

// Admin endpoint: fetches all routes + permissions
export const GET_ADMIN_ROUTES_PERMISSIONS: APIData = new APIData(
  "auth/admin/routes-permissions",
  APIMethod.GET,
  { public: false }  // Requires auth + SUPER_ADMIN role
);

// Store endpoint: fetches user's accessible routes
export const GET_STORE_ROUTES: APIData = new APIData(
  "store/dashboard/routes",
  APIMethod.GET,
  { public: false }  // Requires auth
);
```

### 3c. Async Thunks (`libs-common/api-manager/src/lib/routes/api-thunk.ts`)

```ts
import { GET_ADMIN_ROUTES_PERMISSIONS, GET_STORE_ROUTES } from "./api-data";
import type { FetchRoutesRequest } from "./request-dto";

/**
 * Fetch all system routes and permissions for SUPER_ADMIN users
 * Used to populate admin panel navigation and permission management
 */
export const fetchAdminRoutesAndPermissions =
  GET_ADMIN_ROUTES_PERMISSIONS.generateAsyncThunk<FetchRoutesRequest>(
    "routes/fetchAdminRoutesAndPermissions"
  );

/**
 * Fetch store-specific routes for authenticated users
 * Used to populate user dashboard navigation based on store and role
 */
export const fetchStoreRoutes =
  GET_STORE_ROUTES.generateAsyncThunk<FetchRoutesRequest>(
    "routes/fetchStoreRoutes"
  );
```

**Thunk Behavior:**
- Receives no parameters (empty `FetchRoutesRequest`)
- Makes HTTP GET request via `@nks/api-manager`'s configured client (includes base URL, auth headers)
- Returns `ApiResponse<RoutesAndPermissionsData>`
- On error, rejects with `SerializedApiError`

### 3d. Public Exports (`libs-common/api-manager/src/lib/routes/index.ts`)

```ts
// Types
export type {
  FetchRoutesRequest,
  Route,
  Permission,
  RoutesAndPermissionsData,
  RoutesAndPermissionsResponse,
} from "./request-dto";

// Endpoints
export {
  GET_ADMIN_ROUTES_PERMISSIONS,
  GET_STORE_ROUTES,
} from "./api-data";

// Thunks
export {
  fetchAdminRoutesAndPermissions,
  fetchStoreRoutes,
} from "./api-thunk";
```

---

## 4. State Management (Redux Slice)

### 4a. State Shape (`libs-common/state-manager/src/lib/shared-slice/routes/model.ts`)

```ts
import type { APIState } from "@nks/shared-types";

export interface Route {
  id: number;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: string;
  fullPath?: string;
  sortOrder?: number;
  parentRouteFk?: number | null;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface RoutesState extends APIState {
  routes: Route[];
  permissions: Permission[];
  isSynced: boolean;        // Cache flag: true = data already fetched
  fetchedAt: number;        // Timestamp of last successful fetch
  error: string | null;
  fetchState: APIState;     // { isLoading, hasError, errors }
}
```

### 4b. Slice Definition (`libs-common/state-manager/src/lib/shared-slice/routes/slice.ts`)

```ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAdminRoutesAndPermissions,
  fetchStoreRoutes,
  type RoutesAndPermissionsData,
  type Route,
  type Permission,
} from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { RoutesState } from "./model";

const initialState: RoutesState = {
  routes: [],
  permissions: [],
  isSynced: false,
  fetchedAt: 0,
  error: null,
  fetchState: { ...defaultAPIState },
};

/**
 * Wrapper thunk that dispatches the appropriate API thunk based on user role
 * Routes & permissions are role-specific, so we fetch based on isSuperAdmin
 */
export const fetchRoutesAndPermissions = createAsyncThunk(
  "routes/fetchRoutesAndPermissions",
  async (isSuperAdmin: boolean, { dispatch, rejectWithValue }) => {
    try {
      console.log("[Redux] Fetching routes for isSuperAdmin:", isSuperAdmin);

      let result;
      if (isSuperAdmin) {
        // Admin: fetch all routes + permissions
        result = await dispatch(fetchAdminRoutesAndPermissions({} as any) as any).unwrap();
      } else {
        // User: fetch store-specific routes
        result = await dispatch(fetchStoreRoutes({} as any) as any).unwrap();
      }

      console.log("[Redux] Routes fetched successfully:", result);

      // Extract routes and permissions from ApiResponse wrapper
      const data = result?.data as RoutesAndPermissionsData;
      return {
        routes: data?.routes || [],
        permissions: data?.permissions || [],
      };
    } catch (error: any) {
      console.error("[Redux] Failed to fetch routes:", error);
      return rejectWithValue(error?.message || "Failed to fetch routes");
    }
  }
);

export const routesSlice = createSlice({
  name: "routes",
  initialState,
  reducers: {
    /**
     * Clear routes when user logs out
     * Allows re-fetching on next login (isSynced reset to false)
     */
    clearRoutes(state) {
      state.routes = [];
      state.permissions = [];
      state.isSynced = false;
      state.fetchedAt = 0;
      state.error = null;
      state.fetchState = { ...defaultAPIState };
    },

    /**
     * Manually set routes (if needed for fallback/emergency data)
     */
    setRoutes(
      state,
      action: PayloadAction<{ routes: Route[]; permissions: Permission[] }>
    ) {
      state.routes = action.payload.routes;
      state.permissions = action.payload.permissions;
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      state.fetchState.isLoading = false;
    },
  },

  extraReducers: (builder) => {
    // ── Fetch Routes and Permissions ──

    builder.addCase(fetchRoutesAndPermissions.pending, (state) => {
      state.fetchState.isLoading = true;
      state.fetchState.hasError = false;
      state.fetchState.errors = undefined;
    });

    builder.addCase(fetchRoutesAndPermissions.fulfilled, (state, action) => {
      state.fetchState.isLoading = false;
      state.routes = action.payload.routes;
      state.permissions = action.payload.permissions;
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      console.log("[Redux] Routes synced successfully:", {
        routeCount: action.payload.routes.length,
        permissionCount: action.payload.permissions.length,
      });
    });

    builder.addCase(fetchRoutesAndPermissions.rejected, (state, action) => {
      state.fetchState.isLoading = false;
      state.fetchState.hasError = true;
      state.fetchState.errors = action.payload as string | undefined;
      state.error = action.payload as string | null;
      state.isSynced = false;
      console.error("[Redux] Failed to sync routes:", action.payload);
    });
  },
});

export const { clearRoutes, setRoutes } = routesSlice.actions;
```

### 4c. Public Exports (`libs-common/state-manager/src/lib/shared-slice/routes/index.ts`)

```ts
export { fetchRoutesAndPermissions, routesSlice, clearRoutes, setRoutes } from './slice';
export type { Route, Permission, RoutesState } from './model';
```

---

## 5. Dispatch Patterns

### 5a. Fetch Routes on Authentication (Layout)

```ts
import { fetchRoutesAndPermissions } from "@nks/state-manager";
import { useBaseStoreDispatch, useBaseStoreSelector } from "@nks/state-manager";
import { useAuth } from "@libs-web/web-utils/auth-provider";

export default function AppDashboardLayout({ children }) {
  const dispatch = useBaseStoreDispatch();
  const { user: authUser, isAuthenticated, isLoading } = useAuth();
  const routesState = useBaseStoreSelector((state) => state.routes);

  useEffect(() => {
    // Skip if already authenticating, not authenticated, or routes already synced
    if (!isAuthenticated || isLoading || routesState?.isSynced) {
      return;
    }

    // Determine user role
    const isSuperAdmin = authUser?.access?.isSuperAdmin ?? false;

    // Dispatch wrapper thunk (handles role-based endpoint selection)
    dispatch(fetchRoutesAndPermissions(isSuperAdmin) as any);
  }, [isAuthenticated, isLoading, routesState?.isSynced, authUser, dispatch]);

  // Render layout...
}
```

**Key Points:**
- `isSynced` check prevents re-fetching on subsequent renders
- Role-based logic (`isSuperAdmin`) is passed to wrapper thunk
- Wrapper thunk handles endpoint selection internally

### 5b. Clear Routes on Logout (Layout)

```ts
import { clearRoutes } from "@nks/state-manager";

function handleLogout() {
  try {
    // Call signOut API endpoint...
  } finally {
    dispatch(clearRoutes());     // ← clear Redux state
    authLogout();                // ← clear auth provider state
    router.push(ROUTES.LOGIN);
  }
}
```

### 5c. Manually Set Routes (Emergency/Fallback)

```ts
import { setRoutes } from "@nks/state-manager";

function useRoutesFallback() {
  const dispatch = useBaseStoreDispatch();

  const setFallbackRoutes = () => {
    dispatch(setRoutes({
      routes: defaultRoutes,
      permissions: defaultPermissions,
    }));
  };

  return { setFallbackRoutes };
}
```

---

## 6. State Access (Selectors)

### Pattern 1: Full Routes State

```ts
import { useBaseStoreSelector } from "@nks/state-manager";

function MyComponent() {
  const routesState = useBaseStoreSelector((state) => state.routes);

  console.log(routesState.routes);         // Route[]
  console.log(routesState.permissions);    // Permission[]
  console.log(routesState.isSynced);       // boolean
  console.log(routesState.fetchState.isLoading);  // boolean
  console.log(routesState.error);          // string | null
}
```

### Pattern 2: Specific Fields

```ts
const isLoadingRoutes = useBaseStoreSelector(
  (state) => state.routes.fetchState.isLoading
);

const navigationRoutes = useBaseStoreSelector(
  (state) => state.routes.routes
);

const routesError = useBaseStoreSelector(
  (state) => state.routes.error
);
```

### Pattern 3: Deduplicate Routes (Sidebar)

```ts
const navigationRoutes = useBaseStoreSelector((state) => state.routes?.routes || []);

// Remove duplicates by routePath
const uniqueRoutes = Array.from(
  new Map(navigationRoutes.map((r: Route) => [r.routePath, r])).values()
) as Route[];
```

---

## 7. Component Integration

### 7a. Sidebar/Layout (`apps/nks-web/src/app/(protected)/layout.tsx`)

```tsx
const routesState = useBaseStoreSelector((state) => state.routes);
const navigationRoutes = routesState?.routes || [];
const isLoadingRoutes = routesState?.fetchState?.isLoading || false;

// Map icon names to Lucide components
const iconMap: Record<string, any> = {
  LayoutDashboard: Icons.LayoutDashboard,
  Home: Icons.Home,
  Users: Icons.Users,
  // ...
};

// Sidebar config
const sidebarConfig: SidebarConfig = {
  logoIcon: <Icons.LayoutDashboard className="size-6" />,
  logoText: "NKS Dashboard",
  items: uniqueRoutes.map((route: Route) => ({
    id: String(route.id),
    label: route.routeName,
    href: route.fullPath || route.routePath,
    icon: iconMap[route.iconName || "LayoutDashboard"] || Icons.LayoutDashboard,
  })),
};
```

### 7b. Dashboard/Routes Display (`apps/nks-web/src/app/(protected)/dashboard/page.tsx`)

```tsx
const routesState = useBaseStoreSelector((state) => state.routes);
const routes = routesState?.routes || [];
const isLoadingRoutes = routesState?.fetchState?.isLoading || false;
const routesError = routesState?.error || null;

// Show loading state
if (isLoadingRoutes) {
  return <div><Loader2 className="animate-spin" /></div>;
}

// Show error state
if (routesError) {
  return <Card><p className="text-destructive">{routesError}</p></Card>;
}

// Show routes grouped by type
const routesByType = routes.reduce((acc, route) => {
  const type = route.routeType || "Other";
  if (!acc[type]) acc[type] = [];
  acc[type].push(route);
  return acc;
}, {});
```

---

## 8. Import Structure

### From `@nks/api-manager`

```ts
// Types
import type {
  Route,
  Permission,
  RoutesAndPermissionsData,
  RoutesAndPermissionsResponse,
  FetchRoutesRequest,
} from "@nks/api-manager";

// Endpoints (for advanced usage)
import {
  GET_ADMIN_ROUTES_PERMISSIONS,
  GET_STORE_ROUTES,
} from "@nks/api-manager";

// API Thunks (rarely used directly — wrapper thunk is preferred)
import {
  fetchAdminRoutesAndPermissions,
  fetchStoreRoutes,
} from "@nks/api-manager";
```

### From `@nks/state-manager`

```ts
// Async thunk (wrapper — handles role-based dispatch)
import { fetchRoutesAndPermissions } from "@nks/state-manager";

// Sync actions
import { clearRoutes, setRoutes } from "@nks/state-manager";

// Types
import type { RoutesState } from "@nks/state-manager";

// Typed hooks
import {
  useBaseStoreDispatch,
  useBaseStoreSelector,
} from "@nks/state-manager";
```

---

## 9. Data Flow Summary

```
User logs in (auth/login/fulfilled)
      │
      ▼
Layout mounts
      │
      ▼
useEffect checks:
  ├── isAuthenticated? (yes)
  ├── isLoading? (no)
  ├── isSynced? (no) ← first time, will fetch
      │
      ▼
dispatch(fetchRoutesAndPermissions(isSuperAdmin))
      │
      ├── .pending
      │   └─→ state.fetchState.isLoading = true
      │
      ├── .fulfilled
      │   ├─→ Wrapper thunk extracts data from ApiResponse
      │   └─→ state.routes = data.routes
      │       state.permissions = data.permissions
      │       state.isSynced = true ← cache flag
      │
      └── .rejected
          └─→ state.error = error message
              state.isSynced = false ← allow retry on next login

Component reads state:
  useBaseStoreSelector((state) => state.routes.routes)
  useBaseStoreSelector((state) => state.routes.fetchState.isLoading)

Subsequent navigations:
  Layout useEffect checks isSynced (true) → skips dispatch → uses cached data

User logs out:
  dispatch(clearRoutes())
      │
      ▼
  state.isSynced = false ← allows re-fetch on next login
  state.routes = []
```

---

## 10. Caching Strategy Details

### Session-Scoped Cache

| Event | Action | Cache State |
|-------|--------|---|
| User logs in | Check `isSynced` | false |
| First navigation | Dispatch thunk, fetch API | fetch in progress |
| API completes | Set `isSynced = true` | cached ✓ |
| Navigate away & back | Check `isSynced` | true → use cache |
| Navigate to different page | Check `isSynced` | true → use cache |
| User logs out | `dispatch(clearRoutes())` | isSynced = false |
| User logs in again | Check `isSynced` | false → fetch again |

### Benefits

- **Single API call per session** — no repeated requests
- **Consistent navigation** — same routes across all pages
- **Reduced latency** — subsequent renders use in-memory state
- **Auto-invalidation** — logout clears cache, next login refetches
- **Role-aware** — admin gets different routes than users

### Trade-offs

| Pro | Con |
|---|---|
| Fast (in-memory) | Requires logout to refresh |
| Simple (one fetch) | Dynamic role changes mid-session not reflected |
| Reduces server load | Users can't manually refresh routes |

---

## 11. Redux DevTools Logging

The slice includes console logging for development debugging:

```ts
// On fetch start
"[Redux] Fetching routes for isSuperAdmin: true/false"

// On successful API fetch
"[Redux] Routes fetched successfully: { /* raw API response */ }"

// On sync complete
"[Redux] Routes synced successfully: { routeCount: 12, permissionCount: 45 }"

// On error
"[Redux] Failed to fetch routes: error message"
"[Redux] Failed to sync routes: error message"
```

Enable Redux DevTools browser extension to monitor state changes in real-time.

---

## 12. Serializable Check Exceptions

RTK requires all state to be serializable. Routes payload may contain non-serializable objects (timestamps, etc.):

```ts
// base-reducer.ts
export const baseStore = configureStore({
  reducer: baseReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "routes/fetchRoutesAndPermissions/fulfilled",
          // ...other actions
        ],
      },
    }),
});
```

---

## 13. Error Scenarios & Handling

| Scenario | What Happens | User Sees | Next Steps |
|---|---|---|---|
| **API returns 401** | Auth guard intercepts | Redirected to login | Auto-logout clears routes |
| **API returns 404** | Thunk rejects | Error message in dashboard | Manual refresh (logout → login) |
| **Network timeout** | Thunk rejects | "Failed to fetch routes" | Retry on next page load |
| **Empty routes array** | State updates with `routes: []` | Empty sidebar | "No routes available" message |
| **Malformed response** | JSON parse error → reject | Error message | Fallback to `setRoutes()` action |

---

## 14. Testing Strategies

### Test Cache Hit (no API call on re-render)

```ts
// 1. Login → routes fetched, isSynced = true
// 2. Navigate away & back → no network request (Redux selector fast-returns)
// 3. Verify in DevTools: only 1 API call total
```

### Test Role-Based Fetch

```ts
// Login as SUPER_ADMIN
// Verify: GET auth/admin/routes-permissions called
// Verify: sidebar shows admin routes

// Logout, login as USER
// Verify: GET store/dashboard/routes called
// Verify: sidebar shows user-specific routes
```

### Test Logout Cleanup

```ts
// Login → routes cached
// Logout → dispatch(clearRoutes())
// Verify: state.isSynced = false, state.routes = []
// Login again → routes fetched again (not from stale cache)
```

---

## 15. Related Documentation

- [Routes Slice Implementation Details](/libs-common/state-manager/src/lib/shared-slice/routes/ROUTES_SLICE.md)
- [API Manager Routes Module](/libs-common/api-manager/src/lib/routes/)
- [Backend Routes API](/apps/nks-backend/src/modules/auth/)
- [API Integration Guide - Part A Pattern](/docs/api-integration.md)
