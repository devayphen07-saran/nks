# Routes & Permissions Slice Documentation

## Overview

The Routes & Permissions slice manages the global state for application routes and user permissions. It implements a caching strategy where routes are fetched once per session and stored in Redux, preventing repeated API calls.

## Architecture Pattern

This implementation follows the **Part A Pattern** from the API Integration Guide:
- **API Manager Layer**: Handles API requests via `@nks/api-manager`
- **State Manager Layer**: Manages Redux state via `@nks/state-manager`
- **Web Layer**: Consumes Redux state via React hooks

## State Structure

```typescript
export interface RoutesState {
  routes: Route[];
  permissions: Permission[];
  isSynced: boolean;
  fetchedAt: number;
  error: string | null;
  fetchState: APIState;
}
```

### Fields

| Field | Type | Purpose |
|-------|------|---------|
| `routes` | `Route[]` | Array of available navigation routes |
| `permissions` | `Permission[]` | Array of user permissions |
| `isSynced` | `boolean` | Flag indicating if data has been fetched (caching) |
| `fetchedAt` | `number` | Timestamp of last successful fetch |
| `error` | `string \| null` | Error message from failed fetch |
| `fetchState.isLoading` | `boolean` | Loading state during API call |
| `fetchState.hasError` | `boolean` | Whether an error occurred |
| `fetchState.errors` | `string \| undefined` | Error details |

## Data Models

### Route

```typescript
interface Route {
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
```

### Permission

```typescript
interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}
```

## Thunks

### `fetchRoutesAndPermissions(isSuperAdmin: boolean)`

**Wrapper thunk** that dispatches the appropriate API thunk based on user role.

**Parameters:**
- `isSuperAdmin: boolean` - User's admin status

**Behavior:**
1. Determines which API endpoint to call based on `isSuperAdmin`
2. Dispatches `fetchAdminRoutesAndPermissions` for admin users
3. Dispatches `fetchStoreRoutes` for regular users
4. Extracts routes and permissions from API response
5. Returns payload with `{ routes: Route[], permissions: Permission[] }`

**States:**
- **Pending**: Sets `fetchState.isLoading = true`
- **Fulfilled**: Updates `routes`, `permissions`, `isSynced = true`, `fetchedAt = Date.now()`
- **Rejected**: Sets `fetchState.hasError = true`, stores error message

### API Thunks (from @nks/api-manager)

#### `fetchAdminRoutesAndPermissions()`
- **Endpoint**: `auth/admin/routes-permissions`
- **Method**: `GET`
- **Auth**: Required (SUPER_ADMIN role)
- **Response**: `RoutesAndPermissionsData`

#### `fetchStoreRoutes()`
- **Endpoint**: `store/dashboard/routes`
- **Method**: `GET`
- **Auth**: Required
- **Response**: `RoutesAndPermissionsData`

## Actions

### `clearRoutes()`

Clears all routes and permissions from state. Called on user logout.

**Effects:**
- Resets `routes` to `[]`
- Resets `permissions` to `[]`
- Sets `isSynced = false` (allows re-fetch on next login)
- Sets `fetchedAt = 0`
- Clears error message

**Usage:**
```typescript
dispatch(clearRoutes());
```

### `setRoutes(payload)`

Manually set routes and permissions. Useful for emergency updates or fallback data.

**Parameters:**
```typescript
{
  routes: Route[];
  permissions: Permission[];
}
```

**Effects:**
- Updates `routes` and `permissions`
- Sets `isSynced = true`
- Sets `fetchedAt = Date.now()`
- Clears error message

**Usage:**
```typescript
dispatch(setRoutes({
  routes: fallbackRoutes,
  permissions: fallbackPermissions
}));
```

## Caching Strategy

The slice implements a **session-scoped caching strategy**:

1. **On Login**: Layout checks `routesState.isSynced`
2. **First Request**: If not synced, dispatches `fetchRoutesAndPermissions(isSuperAdmin)`
3. **Subsequent Requests**: Returns cached data from Redux (no API call)
4. **On Logout**: Dispatches `clearRoutes()` to reset state
5. **New Login**: Cycle repeats

**Benefits:**
- Single API call per session
- Reduced server load
- Faster subsequent page navigations
- Automatic cache invalidation on logout

## Integration Points

### Layout Component
```typescript
// Read routes
const routesState = useBaseStoreSelector((state: any) => state.routes);
const navigationRoutes = routesState?.routes || [];

// Fetch routes on auth
dispatch(fetchRoutesAndPermissions(isSuperAdmin) as any);

// Clear on logout
dispatch(clearRoutes());
```

### Dashboard Component
```typescript
// Read routes
const routesState = useBaseStoreSelector((state: any) => state.routes);
const routes = routesState?.routes || [];
const isLoadingRoutes = routesState?.fetchState?.isLoading || false;
const routesError = routesState?.error || null;
```

### Sidebar Component
```typescript
// Map routes to sidebar items
const sidebarItems = uniqueRoutes.map((route: Route) => ({
  id: String(route.id),
  label: route.routeName,
  href: route.fullPath || route.routePath,
  icon: iconMap[route.iconName || "LayoutDashboard"],
}));
```

## Redux DevTools Logging

The slice includes console logging for debugging:

```typescript
// On fetch start
"[Redux] Fetching routes for isSuperAdmin: " + boolean

// On success
"[Redux] Routes fetched successfully: " + response

// On sync complete
"[Redux] Routes synced successfully: { routeCount, permissionCount }"

// On error
"[Redux] Failed to fetch routes: " + error
"[Redux] Failed to sync routes: " + errorPayload
```

## Error Handling

**API Errors:**
- Caught in wrapper thunk and converted to Redux rejection
- Stored in `state.error` and `state.fetchState.errors`
- UI displays error message to user

**Network Failures:**
- Handled by `@nks/api-manager` with retry logic
- Propagated to slice as rejection with error message

**Type Errors:**
- Route/Permission types imported from `@nks/api-manager`
- TypeScript prevents mismatched data structures
- RoutesState extends APIState for consistency

## Files

| File | Purpose |
|------|---------|
| `model.ts` | Type definitions (Route, Permission, RoutesState) |
| `slice.ts` | Redux slice with thunks and reducers |
| `index.ts` | Exports for public API |

## Usage Examples

### Fetch routes on component mount

```typescript
import { useBaseStoreDispatch, useBaseStoreSelector, fetchRoutesAndPermissions } from "@nks/state-manager";

function Component() {
  const dispatch = useBaseStoreDispatch();
  const routesState = useBaseStoreSelector((state) => state.routes);

  useEffect(() => {
    if (!routesState.isSynced && isAuthenticated) {
      dispatch(fetchRoutesAndPermissions(isSuperAdmin) as any);
    }
  }, [dispatch, isAuthenticated, isSuperAdmin, routesState.isSynced]);

  if (routesState.fetchState.isLoading) return <LoadingSpinner />;
  if (routesState.error) return <ErrorMessage error={routesState.error} />;

  return <NavigationMenu routes={routesState.routes} />;
}
```

### Handle logout

```typescript
import { clearRoutes } from "@nks/state-manager";

function handleLogout() {
  dispatch(clearRoutes());
  authLogout();
  router.push("/login");
}
```

### Update routes manually

```typescript
import { setRoutes } from "@nks/state-manager";

function updateRoutesManually() {
  dispatch(setRoutes({
    routes: newRoutes,
    permissions: newPermissions
  }));
}
```

## Testing

### Test cache hit (no API call on second access)
1. Login and navigate to dashboard
2. Verify `isSynced = true` in Redux DevTools
3. Navigate away and back
4. Verify no new API call in Network tab

### Test role-based fetch
1. Login as admin - should call `auth/admin/routes-permissions`
2. Login as user - should call `store/dashboard/routes`

### Test logout cleanup
1. Login and verify routes loaded
2. Click logout
3. Verify Redux state cleared: `isSynced = false`, `routes = []`
4. Login again and verify routes refetch

## Performance Considerations

| Aspect | Consideration |
|--------|---|
| **Initial Load** | Parallel fetch with auth (no extra latency) |
| **Subsequent Navigations** | O(1) Redux access (no network) |
| **Memory** | Small footprint (100-1000 routes typical) |
| **Stale Data** | Session duration (invalidated on logout) |

## Related Documentation

- [API Integration Guide - Part A Pattern](/docs/api-integration.md)
- [Redux Store Setup](/libs-common/state-manager/src/lib/base-reducer.ts)
- [API Manager Routes](/libs-common/api-manager/src/lib/routes/)
- [Layout Implementation](/apps/nks-web/src/app/(protected)/layout.tsx)
