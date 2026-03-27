# Expo Router + Redux Toolkit — API-Driven Auth, RBAC, Dynamic Menu Architecture

## Context & Stack

You are a senior React Native / Expo Router developer. The app uses:
- Expo Router (file-based routing)
- Redux Toolkit (state management)
- expo-secure-store (encrypted local storage)
- TypeScript
- Axios (HTTP client)

All roles, permissions, side menu items, routes, and field-level permissions come from the API at login time and can be refreshed. There are NO hardcoded roles or menu items in the client.

---

## API Contract

The login endpoint (`POST /auth/login`) and session endpoint (`GET /auth/session`) both return:

```json
{
  "accessToken": "JWT...",
  "refreshToken": "JWT...",
  "user": { "id": "uuid", "name": "John", "email": "john@example.com", "avatar": "url" },
  "role": "manager",
  "permissions": ["reports:view", "reports:export", "team:manage"],
  "menu": [
    {
      "id": "dashboard",
      "label": "Dashboard",
      "icon": "home",
      "route": "/(app)/dashboard",
      "permission": null,
      "children": []
    },
    {
      "id": "reports",
      "label": "Reports",
      "icon": "chart",
      "route": "/(app)/reports",
      "permission": "reports:view",
      "children": [
        {
          "id": "reports-export",
          "label": "Export",
          "icon": "download",
          "route": "/(app)/reports/export",
          "permission": "reports:export",
          "children": []
        }
      ]
    }
  ],
  "fieldPermissions": {
    "employee": {
      "salary": ["admin", "hr_manager"],
      "performance_rating": ["admin", "manager", "hr_manager"]
    }
  }
}
```

---

## TypeScript Types

```ts
// types/session.ts

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;               // MUST match a real file in app/ directory
  permission: string | null;   // null = visible to all authenticated users
  badge?: string;
  children?: MenuItem[];
}

export interface FieldPermissions {
  [resource: string]: {
    [field: string]: string[]; // roles allowed to see this field
  };
}

export type Role = string; // dynamic from API — not a hardcoded union

export interface SessionData {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  role: Role;
  permissions: string[];
  menu: MenuItem[];
  fieldPermissions: FieldPermissions;
  fetchedAt: number; // Date.now() when session was fetched
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends SessionData, AuthTokens {}
```

---

## Folder Structure

```
app/
  _layout.tsx                  ← root layout — hydration gate
  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
    forgot-password.tsx
  (app)/
    _layout.tsx                ← auth check gate
    dashboard.tsx
    unauthorized.tsx
    reports/
      index.tsx
      export.tsx
    team/
      index.tsx
    admin/
      users.tsx
      settings.tsx
    payroll/
      index.tsx

store/
  store.ts
  sessionSlice.ts

services/
  storageService.ts            ← SecureStore wrapper
  sessionApi.ts                ← API calls
  apiClient.ts                 ← Axios instance + interceptors

hooks/
  usePermission.ts
  useFieldPermission.ts
  useRouteGuard.ts
  useSessionRefresh.ts

components/
  DynamicSideMenu.tsx
  PermissionGate.tsx
  FieldGate.tsx
```

> IMPORTANT: Every route string that the API can return in `menu[].route` MUST have a corresponding file in the `app/` directory. Expo Router is file-based — the API controls visibility, not file existence.

---

## SecureStore Service

```ts
// services/storageService.ts
import * as SecureStore from 'expo-secure-store';

// WARNING: SecureStore has a 2048 byte limit per key.
// Store tokens and session in separate keys.
// If session JSON exceeds ~1800 bytes, store only role + permissions
// and re-fetch menu from API on every boot.

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  SESSION: 'user_session',
} as const;

export const storageService = {
  async saveTokens(tokens: AuthTokens) {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, tokens.refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async saveSession(session: SessionData) {
    const serialized = JSON.stringify(session);

    // If too large, store minimal session and force re-fetch on boot
    if (serialized.length > 1800) {
      const minimal: SessionData = {
        ...session,
        menu: [],        // empty = will trigger re-fetch
        fetchedAt: 0,    // 0 = immediately stale
      };
      await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(minimal));
      return;
    }

    await SecureStore.setItemAsync(KEYS.SESSION, serialized);
  },

  async getSession(): Promise<SessionData | null> {
    const raw = await SecureStore.getItemAsync(KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  },

  async clearAll() {
    await Promise.all(
      Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k))
    );
  },
};
```

---

## Redux sessionSlice

```ts
// store/sessionSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storageService } from '../services/storageService';
import { sessionApi } from '../services/sessionApi';
import { jwtDecode } from 'jwt-decode';
import type { RootState } from './store';

const STALE_MS = 15 * 60 * 1000; // 15 minutes

interface SessionState extends Partial<SessionData> {
  isAuthenticated: boolean;
  hydrated: boolean;   // ← CRITICAL: prevents flash of login screen on boot
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionState = {
  isAuthenticated: false,
  hydrated: false,     // becomes true after SecureStore read completes
  isLoading: false,
  error: null,
  user: undefined,
  role: undefined,
  permissions: [],
  menu: [],
  fieldPermissions: {},
  fetchedAt: 0,
};

// Step 1 — runs once on app boot
export const hydrateSession = createAsyncThunk(
  'session/hydrate',
  async (_, { dispatch }) => {
    const token = await storageService.getAccessToken();
    if (!token) return null;

    // Validate token expiry
    const { exp } = jwtDecode<{ exp: number }>(token);
    if (exp < Date.now() / 1000) {
      const refreshToken = await storageService.getRefreshToken();
      if (!refreshToken) {
        await storageService.clearAll();
        return null;
      }
      const newTokens = await sessionApi.refresh(refreshToken);
      await storageService.saveTokens(newTokens);
    }

    // Load cached session
    const cached = await storageService.getSession();
    if (!cached) return null;

    // If stale or menu missing, trigger background re-fetch
    // Do NOT await — show cached data immediately, refresh silently
    const isStale = Date.now() - cached.fetchedAt > STALE_MS;
    if (isStale || cached.menu.length === 0) {
      dispatch(refreshSession());
    }

    return cached;
  }
);

// Re-fetch fresh session from API
export const refreshSession = createAsyncThunk(
  'session/refresh',
  async () => {
    const fresh = await sessionApi.getSession(); // GET /auth/session
    const session: SessionData = { ...fresh, fetchedAt: Date.now() };
    await storageService.saveSession(session);
    return session;
  }
);

// Full login
export const login = createAsyncThunk(
  'session/login',
  async (credentials: { email: string; password: string }) => {
    const response: LoginResponse = await sessionApi.login(credentials);
    await storageService.saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    const session: SessionData = {
      user: response.user,
      role: response.role,
      permissions: response.permissions,
      menu: response.menu,
      fieldPermissions: response.fieldPermissions,
      fetchedAt: Date.now(),
    };
    await storageService.saveSession(session);
    return session;
  }
);

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    logout(state) {
      Object.assign(state, initialState);
      state.hydrated = true; // stay hydrated so splash doesn't re-appear
      storageService.clearAll();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.hydrated = true; // always set — even if no session found
        if (action.payload) {
          Object.assign(state, action.payload);
          state.isAuthenticated = true;
        }
      })
      .addCase(hydrateSession.rejected, (state) => {
        state.hydrated = true; // always set — prevents infinite splash
      })
      .addCase(refreshSession.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.isAuthenticated = true;
        state.isLoading = false;
        state.hydrated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Login failed';
      });
  },
});

export const { logout } = sessionSlice.actions;
export default sessionSlice.reducer;

// Selectors
export const selectMenu = (s: RootState) => s.session.menu ?? [];
export const selectPermissions = (s: RootState) => s.session.permissions ?? [];
export const selectRole = (s: RootState) => s.session.role;
export const selectFieldPermissions = (s: RootState) => s.session.fieldPermissions ?? {};
export const selectUser = (s: RootState) => s.session.user;
export const selectIsAuthenticated = (s: RootState) => s.session.isAuthenticated;
export const selectHydrated = (s: RootState) => s.session.hydrated;
```

---

## Root Layout — Navigation Gate

```tsx
// app/_layout.tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { hydrateSession, selectHydrated, selectIsAuthenticated } from '../store/sessionSlice';
import { useSessionRefresh } from '../hooks/useSessionRefresh';

export default function RootLayout() {
  const dispatch = useDispatch();
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useSelector(selectHydrated);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Boot: read SecureStore and validate token
  useEffect(() => {
    dispatch(hydrateSession());
  }, []);

  // Register AppState foreground re-fetch listener
  useSessionRefresh();

  // Navigate based on auth state — ONLY after hydration completes
  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)/dashboard');
    }
  }, [hydrated, isAuthenticated, segments]);

  // Show nothing (or your SplashScreen) until SecureStore read completes.
  // This is what prevents the flash of the login screen on cold start.
  if (!hydrated) return null;

  return <Slot />;
}
```

---

## App Group Layout — Second Auth Check

```tsx
// app/(app)/_layout.tsx
import { Redirect, Slot } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../../store/sessionSlice';

export default function AppLayout() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
```

---

## Axios Client + Interceptors

```ts
// services/apiClient.ts
import axios from 'axios';
import { store } from '../store/store';
import { logout, refreshSession } from '../store/sessionSlice';
import { storageService } from './storageService';
import { sessionApi } from './sessionApi';

let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: Error | null, token: string | null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// Attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await storageService.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  res => res,
  async (error) => {
    const originalRequest = error.config;

    // 401 — token expired, attempt refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storageService.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const newTokens = await sessionApi.refresh(refreshToken);
        await storageService.saveTokens(newTokens);
        processQueue(null, newTokens.accessToken);

        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err as Error, null);
        store.dispatch(logout());
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 — permissions changed server-side, silently re-fetch session
    if (error.response?.status === 403) {
      store.dispatch(refreshSession());
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Permission Hooks

```ts
// hooks/usePermission.ts
import { useSelector } from 'react-redux';
import { selectPermissions, selectRole } from '../store/sessionSlice';

// Single permission check
export function usePermission(permission: string): boolean {
  const permissions = useSelector(selectPermissions);
  const role = useSelector(selectRole);
  if (role === 'super_admin') return true;
  return permissions.includes(permission);
}

// True if user has ANY of the given permissions
export function useAnyPermission(...perms: string[]): boolean {
  const permissions = useSelector(selectPermissions);
  const role = useSelector(selectRole);
  if (role === 'super_admin') return true;
  return perms.some(p => permissions.includes(p));
}

// True only if user has ALL of the given permissions
export function useAllPermissions(...perms: string[]): boolean {
  const permissions = useSelector(selectPermissions);
  const role = useSelector(selectRole);
  if (role === 'super_admin') return true;
  return perms.every(p => permissions.includes(p));
}
```

```ts
// hooks/useFieldPermission.ts
import { useSelector } from 'react-redux';
import { selectFieldPermissions, selectRole } from '../store/sessionSlice';

// Usage: const canSeeSalary = useFieldPermission('employee', 'salary');
export function useFieldPermission(resource: string, field: string): boolean {
  const fieldPermissions = useSelector(selectFieldPermissions);
  const role = useSelector(selectRole);

  if (!role) return false;
  if (role === 'super_admin') return true;

  const allowedRoles = fieldPermissions?.[resource]?.[field];
  if (!allowedRoles) return true; // no restriction defined = visible by default
  return allowedRoles.includes(role);
}
```

```ts
// hooks/useRouteGuard.ts
// Call this at the top of every protected screen.
// Menu hiding is UX. This is the actual security layer on the client.

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { usePermission } from './usePermission';

export function useRouteGuard(requiredPermission: string): boolean {
  const router = useRouter();
  const allowed = usePermission(requiredPermission);

  useEffect(() => {
    if (!allowed) {
      router.replace('/(app)/unauthorized');
    }
  }, [allowed]);

  return allowed;
}
```

---

## AppState Foreground Re-fetch

```ts
// hooks/useSessionRefresh.ts
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { refreshSession } from '../store/sessionSlice';

const STALE_MS = 15 * 60 * 1000;

export function useSessionRefresh() {
  const dispatch = useDispatch();
  const fetchedAt = useSelector((s: RootState) => s.session.fetchedAt ?? 0);
  const isAuthenticated = useSelector((s: RootState) => s.session.isAuthenticated);

  useEffect(() => {
    const handler = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (!isAuthenticated) return;
      if (Date.now() - fetchedAt > STALE_MS) {
        dispatch(refreshSession());
      }
    };

    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [fetchedAt, isAuthenticated]);
}
```

---

## PermissionGate Component

```tsx
// components/PermissionGate.tsx
import { usePermission } from '../hooks/usePermission';

interface Props {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ permission, fallback = null, children }: Props) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}
```

```tsx
// components/FieldGate.tsx
import { useFieldPermission } from '../hooks/useFieldPermission';

interface Props {
  resource: string;
  field: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FieldGate({ resource, field, children, fallback = null }: Props) {
  const allowed = useFieldPermission(resource, field);
  return <>{allowed ? children : fallback}</>;
}
```

---

## Dynamic Side Menu

```tsx
// components/DynamicSideMenu.tsx
import { ScrollView, View, Pressable, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { useRouter, usePathname } from 'expo-router';
import { selectMenu, selectPermissions, selectRole } from '../store/sessionSlice';
import type { MenuItem } from '../types/session';

export function DynamicSideMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useSelector(selectMenu);
  const permissions = useSelector(selectPermissions);
  const role = useSelector(selectRole);

  const isVisible = (item: MenuItem): boolean => {
    if (!item.permission) return true;
    if (role === 'super_admin') return true;
    return permissions.includes(item.permission);
  };

  // Filter top-level items and their children
  const visibleMenu = menu
    .filter(isVisible)
    .map(item => ({
      ...item,
      children: (item.children ?? []).filter(isVisible),
    }));

  return (
    <ScrollView>
      {visibleMenu.map(item =>
        item.children?.length > 0 ? (
          <View key={item.id}>
            <Text style={{ fontWeight: '600', padding: 12 }}>{item.label}</Text>
            {item.children.map(child => (
              <Pressable
                key={child.id}
                onPress={() => router.push(child.route as any)}
                style={{ paddingLeft: 24, paddingVertical: 10 }}
              >
                <Text style={{
                  fontWeight: pathname === child.route ? '600' : '400',
                }}>
                  {child.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.route as any)}
            style={{ padding: 12 }}
          >
            <Text style={{
              fontWeight: pathname.startsWith(item.route) ? '600' : '400',
            }}>
              {item.label}
            </Text>
          </Pressable>
        )
      )}
    </ScrollView>
  );
}
```

---

## Example Screen with All Guards

```tsx
// app/(app)/reports/export.tsx
import { View, Text, Button } from 'react-native';
import { useRouteGuard } from '../../../hooks/useRouteGuard';
import { FieldGate } from '../../../components/FieldGate';
import { PermissionGate } from '../../../components/PermissionGate';

export default function ExportScreen() {
  // Screen-level guard — redirects if permission missing
  const allowed = useRouteGuard('reports:export');
  if (!allowed) return null;

  return (
    <View>
      <Text>Export Reports</Text>

      {/* Field-level: only certain roles see revenue data */}
      <FieldGate resource="report" field="revenue_breakdown">
        <Text>Revenue breakdown: ...</Text>
      </FieldGate>

      {/* Permission-level: only users with bulk:export see this button */}
      <PermissionGate permission="reports:bulk_export">
        <Button title="Bulk export all" onPress={() => {}} />
      </PermissionGate>
    </View>
  );
}
```

---

## Critical Rules & Pitfalls

### 1. `hydrated` flag is mandatory
Without it, every cold start flashes the login screen for ~300ms before redirecting. Never gate navigation on `isAuthenticated` alone — always wait for `hydrated === true`.

### 2. SecureStore 2048-byte limit
Store tokens and session in separate keys. If the session JSON (user + permissions + menu + fieldPermissions) exceeds ~1800 bytes, store a minimal version (no menu) with `fetchedAt: 0` so it re-fetches on next boot.

### 3. Every API route must have a real file
Expo Router is file-based. If `menu[].route` is `/(app)/payroll` but that file doesn't exist, the app crashes. All possible routes the API can return must exist as files — the API only controls visibility.

### 4. Menu hiding is UX — not security
A user can bypass menu hiding via deep links (push notifications, URL schemes). Every individual screen must call `useRouteGuard('permission:name')` independently. Defense in depth.

### 5. Token refresh race condition
If 2 API calls both get a 401 simultaneously, use the queuing pattern in the Axios interceptor. Without it you'll fire 2 refresh requests in parallel and invalidate the second new token immediately.

### 6. Permissions go stale after role changes
If an admin changes a user's role server-side, the client keeps old data. Mitigate with: AppState foreground listener (re-fetch if stale), 403 response handler (immediate re-fetch), and a reasonable TTL (15 min default).

### 7. Logout must clear everything
Clear SecureStore, reset Redux state, and clear any API caches (React Query, Apollo). A partial logout leaves stale data visible when a new user logs in on the same device.

### 8. Don't trust client-side permission checks for sensitive operations
The UI gating is for UX only. Your API endpoints must validate the JWT and enforce permissions server-side on every request. Client RBAC is convenience — server RBAC is security.
