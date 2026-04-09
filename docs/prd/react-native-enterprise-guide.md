# React Native Enterprise Mobile Application Guide

> A senior developer's complete reference for building production-grade, offline-first React Native applications.

---

## Table of Contents

1. [Offline-First Architecture](#1-offline-first-architecture)
2. [Project Setup](#2-project-setup)
3. [Navigation](#3-navigation)
4. [State Management](#4-state-management)
5. [UI & Styling](#5-ui--styling)
6. [Performance](#6-performance)
7. [Auth & Security](#7-auth--security)
8. [API & Networking](#8-api--networking)
9. [Testing](#9-testing)
10. [Build & Deployment](#10-build--deployment)

---

## 1. Offline-First Architecture

The core mindset shift: **treat the network as an enhancement, not a dependency.** Build every feature assuming it will be used offline first, and verify it works in airplane mode before calling it done.

### 1.1 Architecture Overview

```
UI Layer
  └─ Reads ONLY from Local DB (never directly from API)

Local Database (Single Source of Truth)
  └─ WatermelonDB / SQLite — always available offline

Sync Engine
  ├─ Change Tracker     → Dirty flags + timestamps
  ├─ Queue Manager      → Ordered ops, retry logic
  └─ Background Sync    → WorkManager (Android) / BGFetch (iOS)

Conflict Resolver
  └─ Last-write-wins / Field-level merge / Server-wins (per entity)

Remote API + Auth
  ├─ REST / GraphQL with delta sync endpoints
  └─ Encrypted keychain token storage
```

The golden rule: **UI never talks to the API.** All data flows through Local DB → Sync Engine → Remote.

### 1.2 Local Data Layer

This is the most critical pillar. Everything else depends on it.

**Database choice:**

- **WatermelonDB** — best for performance at scale; uses lazy loading and observables, battle-tested for enterprise
- **SQLite via `expo-sqlite`** — simpler, good for moderate data volumes
- Avoid `AsyncStorage` for anything beyond tiny key-value config

**Schema design — every table must have:**

| Field        | Type      | Purpose                        |
| ------------ | --------- | ------------------------------ |
| `id`         | UUID      | Local primary key              |
| `server_id`  | String    | Remote ID                      |
| `created_at` | Timestamp | Creation time                  |
| `updated_at` | Timestamp | Last modified (device clock)   |
| `_status`    | Enum      | `synced`, `pending`, `deleted` |
| `_changed`   | Bitmask   | Tracks which fields are dirty  |

### 1.3 Sync Engine Architecture

This is where most teams get it wrong. You need a structured, predictable sync layer.

**Outbox pattern — the correct approach:**

1. Every mutation writes to a local `operations_queue` table first, then to the main data table
2. The sync engine drains the queue in order when connectivity is available
3. Assign exponential backoff to failed operations: 1s → 2s → 4s → 16s → max 5 min
4. Tag each operation with an `idempotency_key` (UUID) so server-side duplicates are safe to reject

```ts
// Example operation queue entry
interface QueuedOperation {
  id: string; // UUID
  idempotency_key: string; // UUID — safe to retry
  entity_type: string; // e.g. "Order"
  entity_id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  created_at: number;
  retry_count: number;
  next_retry_at: number;
  status: "pending" | "failed" | "processing";
}
```

### 1.4 Conflict Resolution Strategy

Define this upfront — it is almost impossible to retrofit.

| Strategy                  | When to use                      | How it works                                                                                |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| **Last-write-wins (LWW)** | Most user-owned data             | Compare `updated_at`; latest wins. Use `server_updated_at` as clock — never device clock.   |
| **Field-level merge**     | Collaborative records            | Track dirty fields via `_changed` bitmask. Two users editing different fields = auto-merge. |
| **Server-wins**           | Financial, inventory, compliance | Device always defers to server. No merge attempted.                                         |

Always store conflicts in a `sync_conflicts` table for audit trail — enterprises will ask for it.

### 1.5 Delta Sync (Server API Design)

Push your backend team toward delta sync endpoints. Each sync call should:

1. Accept a `last_synced_at` cursor from the client
2. Return only records **created, updated, or deleted** since that cursor
3. Return a `server_time` the client stores as the new cursor
4. Include a `deleted_ids` array for tombstoning

```ts
// Ideal delta sync response shape
interface DeltaSyncResponse<T> {
  data: T[];
  deleted_ids: string[];
  server_time: string; // ISO timestamp — client stores as next cursor
  has_more: boolean; // For paginated sync
  next_cursor?: string;
}
```

Avoid syncing entire collections. At enterprise scale (10k+ records), this will kill performance.

### 1.6 Security for Offline Data

- **Encrypt the local DB** using SQLCipher — never store raw PII in plain SQLite
- Use **Keychain (iOS) / Keystore (Android)** for tokens — never `AsyncStorage` for secrets
- Implement **certificate pinning** for API calls to prevent MitM on corporate networks
- Build a **remote wipe** capability: receive push notification → clear local DB + tokens → force re-auth
- Apply **field-level encryption** for particularly sensitive data (SSNs, medical IDs) even inside the encrypted DB

### 1.7 Sync Performance Rules

- Paginate sync pulls — never load more than 500 records per batch
- Run sync off the JS thread — use WatermelonDB's native sync or write a native module
- Lazy-load relations — don't eagerly hydrate full object graphs
- Index every foreign key and every field used in filters
- Monitor DB size — implement data archival if records exceed 100k rows

### 1.8 Offline-First Testing Checklist

| Scenario                     | Expected behavior                          |
| ---------------------------- | ------------------------------------------ |
| Create record while offline  | Saved locally, synced when online          |
| Edit record while offline    | Delta tracked, merged on sync              |
| Delete record while offline  | Tombstoned locally, propagated on sync     |
| Two devices edit same record | Conflict resolver fires, audit log written |
| Sync interrupted mid-batch   | Resumes from last cursor, no duplicates    |
| Token expired during sync    | Refresh queue fires, sync resumes          |
| DB migration on app update   | Migration runs before sync resumes         |

---

## 2. Project Setup

> Structure your project so a new developer can find any file in under 10 seconds without asking anyone.

### 2.1 Expo vs Bare React Native

|                    | Expo Managed           | Bare React Native            |
| ------------------ | ---------------------- | ---------------------------- |
| **Use when**       | 90% of enterprise apps | Custom native modules needed |
| **Build**          | EAS Build (cloud)      | Xcode + Android Studio       |
| **OTA updates**    | EAS Update built-in    | CodePush                     |
| **Native code**    | Expo SDK covers most   | Full control                 |
| **Recommendation** | Start here             | Migrate only if needed       |

### 2.2 Folder Structure

```
src/
  features/
    auth/
      screens/
      hooks/
      services/
      components/
      types.ts
    orders/
      screens/
      hooks/
      services/
      components/
      types.ts
  shared/
    components/        # Reusable UI components
    hooks/             # Shared custom hooks
    utils/             # Pure utility functions
    constants/         # App-wide constants
    theme/             # Design tokens, colors, typography
  navigation/
    RootNavigator.tsx
    AuthNavigator.tsx
    AppNavigator.tsx
    types.ts           # RootStackParamList etc.
  services/
    api.ts             # Axios instance
    sync/              # Sync engine
    db/                # Database setup + migrations
  store/               # Zustand stores
```

**Rule:** Separate by feature, not by type. `/features/auth` scales; `/components` becomes a dumping ground.

### 2.3 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

```js
// babel.config.js — enable path aliases
module.exports = {
  plugins: [
    [
      "module-resolver",
      {
        root: ["./src"],
        alias: { "@": "./src" },
      },
    ],
  ],
};
```

Enable strict mode from day one. Never use `any` — it defeats the purpose.

### 2.4 Environment Configuration

```
.env.development    # Local dev, mock-able APIs
.env.staging        # Production build, staging APIs
.env.production     # Production build, production APIs
```

```ts
// config.ts
import Config from "react-native-config";

export const config = {
  apiBaseUrl: Config.API_BASE_URL,
  apiVersion: Config.API_VERSION ?? "v1",
  sentryDsn: Config.SENTRY_DSN,
} as const;
```

Never commit secrets. Each environment should produce a different bundle ID so all three can co-exist on a device.

---

## 3. Navigation

### 3.1 React Navigation Setup

```bash
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
```

### 3.2 Type-Safe Routes

```ts
// navigation/types.ts
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string };
};

export type AppTabParamList = {
  Home: undefined;
  Orders: { filter?: string };
  Profile: undefined;
};
```

### 3.3 Auth Guard Pattern

```tsx
// navigation/RootNavigator.tsx
function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="App" component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
```

Never use `navigation.navigate()` to redirect away from protected screens. Use conditional navigators — authentication state drives which navigator renders.

### 3.4 Deep Linking Configuration

```ts
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["myapp://", "https://myapp.com"],
  config: {
    screens: {
      App: {
        screens: {
          Orders: {
            path: "orders/:filter",
          },
        },
      },
    },
  },
};
```

Configure both URL schemes (`myapp://`) and Universal Links (`https://`) — enterprise apps need both for notifications and email campaigns.

### 3.5 Navigation Best Practices

- Store minimal params in routes — pass IDs, not full objects
- Fetch data inside the screen using the ID, not from navigation params
- Never store navigation state in Redux
- Use `navigation.setOptions()` for dynamic header buttons
- Use `useFocusEffect` for data refresh when returning to a screen

---

## 4. State Management

> Server state → React Query. Global UI state → Zustand. Component state → useState. This division removes 80% of Redux boilerplate.

### 4.1 Three-Tier Model

| Tier                  | Tool                         | What goes here                                       |
| --------------------- | ---------------------------- | ---------------------------------------------------- |
| Server state          | React Query / TanStack Query | All API data, cache, loading/error states            |
| Global UI state       | Zustand                      | Auth, theme, user preferences, app-wide flags        |
| Local component state | useState / useReducer        | Form values, toggles, local UI state                 |
| Scoped shared state   | React Context                | Theme object, locale, auth user (low frequency only) |

### 4.2 Zustand Store Pattern

```ts
// store/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (user, token) => set({ user, token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}));
```

### 4.3 React Query Pattern

```ts
// features/orders/hooks/useOrders.ts
export function useOrders(filter?: string) {
  return useQuery({
    queryKey: ["orders", filter],
    queryFn: () => OrderService.getOrders(filter),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: OrderService.createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
```

### 4.4 State Colocation Rule

Keep state as close to where it is used as possible. Only lift state when two siblings truly need it. Global state is the last resort, not the first instinct.

---

## 5. UI & Styling

### 5.1 Design Token System

```ts
// theme/tokens.ts
export const colors = {
  primary: { 50: "#EEF2FF", 500: "#6366F1", 900: "#312E81" },
  neutral: { 50: "#F9FAFB", 500: "#6B7280", 900: "#111827" },
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 24, lineHeight: 32 },
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
```

### 5.2 Dark Mode Support

```ts
// theme/useTheme.ts
export function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}
```

All colors must come from your theme — never hardcode `#fff` or `#000`. Test every screen in both modes.

### 5.3 StyleSheet Rules

```ts
// Always use StyleSheet.create, never inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.xl,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
});
```

`StyleSheet.create` validates at build time, enables style ID caching, and reduces bridge traffic.

### 5.4 Layout Principles

| Concept         | React Native default | Note                               |
| --------------- | -------------------- | ---------------------------------- |
| `flexDirection` | `column`             | Opposite to web (row)              |
| `alignItems`    | `stretch`            | Cross-axis alignment               |
| `position`      | `relative`           | Absolute positioning within parent |
| Width/Height    | No CSS box model     | Use `flex`, `%`, or explicit px    |

Use `useWindowDimensions()` for responsive layouts — never hardcode screen widths.

### 5.5 Component Library Strategy

Wrap every third-party component:

```tsx
// shared/components/Button.tsx
// Wraps react-native-paper Button
// If you swap libraries, change only this file
export function Button({
  onPress,
  label,
  variant = "primary",
  loading,
}: ButtonProps) {
  return (
    <PaperButton
      mode={variant === "primary" ? "contained" : "outlined"}
      onPress={onPress}
      loading={loading}
    >
      {label}
    </PaperButton>
  );
}
```

---

## 6. Performance

> Profile with React DevTools Profiler and Flipper before optimizing. Most issues come from avoidable re-renders, not from JS being slow.

### 6.1 FlatList Best Practices

```tsx
<FlatList
  data={orders}
  keyExtractor={(item) => item.id}
  renderItem={renderOrderItem}
  getItemLayout={(_, index) => ({
    // Required for fixed-height rows
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  initialNumToRender={10} // Render only visible items initially
  maxToRenderPerBatch={10}
  windowSize={5} // Render 2.5 screens above and below
  removeClippedSubviews={true} // Android memory optimization
/>
```

Never use `ScrollView` for long lists — it renders all items at once.

### 6.2 Memoization Strategy

```tsx
// Memoize list item components — they re-render on every parent update otherwise
const OrderItem = React.memo(({ order, onPress }: OrderItemProps) => {
  return (
    <TouchableOpacity onPress={() => onPress(order.id)}>...</TouchableOpacity>
  );
});

// In the parent list component
const handlePress = useCallback(
  (id: string) => {
    navigation.navigate("OrderDetail", { id });
  },
  [navigation],
);

// Expensive derivations
const sortedOrders = useMemo(
  () => orders.slice().sort((a, b) => b.createdAt - a.createdAt),
  [orders],
);
```

### 6.3 JS Thread Protection

```ts
// Post-transition work — don't run heavy logic during screen animations
useEffect(() => {
  const interaction = InteractionManager.runAfterInteractions(() => {
    loadHeavyData();
  });
  return () => interaction.cancel();
}, []);
```

Never block the JS thread with heavy computation. Move heavy logic to native modules or use `runAfterInteractions`.

### 6.4 Image Optimization

```tsx
import FastImage from "react-native-fast-image";

<FastImage
  source={{
    uri: imageUrl,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable,
  }}
  style={styles.thumbnail}
  resizeMode={FastImage.resizeMode.cover}
/>;
```

Always resize images to display size on the server — never load a 2000px image for a 100px thumbnail.

### 6.5 Hermes Engine

Hermes is the default JS engine from RN 0.70+. It reduces startup time, memory, and app size significantly. Verify it is enabled in both iOS and Android builds:

```ruby
# iOS — Podfile
use_react_native!(:hermes_enabled => true)
```

```gradle
// Android — android/app/build.gradle
project.ext.react = [
  enableHermes: true
]
```

---

## 7. Auth & Security

> Never trust the client. All auth enforcement happens on the server. Client-side checks are UX, not security.

### 7.1 Token Storage

```ts
import * as Keychain from "react-native-keychain";

// Store — uses Secure Enclave (iOS) / Keystore (Android)
await Keychain.setGenericPassword("token", accessToken, {
  service: "com.myapp.auth",
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
});

// Retrieve
const credentials = await Keychain.getGenericPassword({
  service: "com.myapp.auth",
});
const token = credentials ? credentials.password : null;

// Clear on logout
await Keychain.resetGenericPassword({ service: "com.myapp.auth" });
```

Never store tokens in `AsyncStorage` — it is plain text and unencrypted.

### 7.2 Token Refresh Queue

```ts
// services/api.ts
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await AuthService.refreshToken();
        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        useAuthStore.getState().logout();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

This pattern queues all requests during a token refresh and replays them — prevents multiple simultaneous refresh calls.

### 7.3 Biometric Authentication

```ts
import ReactNativeBiometrics from "react-native-biometrics";

const rnBiometrics = new ReactNativeBiometrics();

async function authenticateWithBiometrics(): Promise<boolean> {
  const { available } = await rnBiometrics.isSensorAvailable();
  if (!available) return false;

  const { success } = await rnBiometrics.simplePrompt({
    promptMessage: "Confirm your identity",
    cancelButtonText: "Use PIN instead",
  });

  return success;
}
```

Use biometrics as a convenient unlock layer over a primary auth session — not as the only authentication factor.

### 7.4 Certificate Pinning

```ts
import { fetch } from "react-native-ssl-pinning";

const response = await fetch("https://api.myapp.com/orders", {
  method: "GET",
  sslPinning: {
    certs: ["api_cert_sha256_hash"], // SHA-256 of your cert's public key
  },
  headers: { Authorization: `Bearer ${token}` },
});
```

Update pins before certificate expiry — pin rotation is critical and must be coordinated with backend.

### 7.5 Security Checklist

- [ ] Tokens stored in Keychain/Keystore, not AsyncStorage
- [ ] Token refresh queue implemented (no concurrent refreshes)
- [ ] Certificate pinning enabled for production API
- [ ] Local DB encrypted with SQLCipher
- [ ] Remote wipe capability via push notification
- [ ] Jailbreak/root detection for sensitive features
- [ ] Biometric auth enabled as optional convenience layer
- [ ] No sensitive data in navigation params or logs
- [ ] ProGuard/R8 minification enabled for Android release builds

---

## 8. API & Networking

### 8.1 Axios Instance

```ts
// services/api.ts
import axios from "axios";
import { config } from "@/config";

export const api = axios.create({
  baseURL: `${config.apiBaseUrl}/${config.apiVersion}`,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach auth token to every request
api.interceptors.request.use(async (req) => {
  const token = await TokenService.getAccessToken();
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});
```

Never create ad-hoc axios instances. One instance per API, configured once.

### 8.2 Service Layer Pattern

```ts
// features/orders/services/OrderService.ts
export const OrderService = {
  getOrders: async (filter?: string): Promise<Order[]> => {
    const response = await api.get<ApiResponse<Order[]>>("/orders", {
      params: { filter },
    });
    return response.data.data;
  },

  createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
    const response = await api.post<ApiResponse<Order>>("/orders", payload);
    return response.data.data;
  },

  deleteOrder: async (id: string): Promise<void> => {
    await api.delete(`/orders/${id}`);
  },
};
```

Components call services, services call HTTP. Swapping APIs means changing one file.

### 8.3 Normalized Error Handling

```ts
// services/ApiError.ts
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Handle specific status codes differently
function handleHttpError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as any;

  switch (status) {
    case 401:
      return new ApiError("UNAUTHORIZED", "Session expired", 401);
    case 403:
      return new ApiError("FORBIDDEN", "Access denied", 403);
    case 422:
      return new ApiError(
        "VALIDATION_FAILED",
        "Invalid input",
        422,
        data?.errors,
      );
    case 503:
      return new ApiError("SERVICE_UNAVAILABLE", "Service down", 503);
    default:
      return new ApiError("UNKNOWN_ERROR", "Something went wrong", status);
  }
}
```

### 8.4 Network State Handling

```ts
import NetInfo from "@react-native-community/netinfo";

// Global network listener
export function useNetworkState() {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  return isConnected;
}
```

Show appropriate UI when offline — not just a blank screen. Queue mutations when offline.

### 8.5 Request Cancellation

```ts
// Cancel in-flight requests on component unmount
function useOrderSearch(query: string) {
  const [results, setResults] = useState<Order[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/orders/search", {
        params: { q: query },
        signal: controller.signal,
      })
      .then((res) => setResults(res.data.data))
      .catch((err) => {
        if (!axios.isCancel(err)) console.error(err);
      });

    return () => controller.abort();
  }, [query]);

  return results;
}
```

---

## 9. Testing

> Testing pyramid: many unit tests (fast, cheap) → some integration tests → few E2E tests (slow, expensive). Invert this and your CI will take 30 minutes.

### 9.1 Unit Testing — React Native Testing Library

```tsx
// features/auth/screens/__tests__/LoginScreen.test.tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";

describe("LoginScreen", () => {
  it("shows error on invalid credentials", async () => {
    jest
      .spyOn(AuthService, "login")
      .mockRejectedValue(
        new ApiError("UNAUTHORIZED", "Invalid credentials", 401),
      );

    const { getByLabelText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByLabelText("Email"), "bad@email.com");
    fireEvent.changeText(getByLabelText("Password"), "wrongpass");
    fireEvent.press(getByText("Sign in"));

    await waitFor(() => {
      expect(getByText("Invalid credentials")).toBeTruthy();
    });
  });
});
```

Test component behavior, not implementation. Query by role/label/text — never by `testID` unless absolutely necessary.

### 9.2 Custom Hook Testing

```ts
// features/orders/hooks/__tests__/useOrders.test.ts
import { renderHook, waitFor } from "@testing-library/react-native";

describe("useOrders", () => {
  it("returns orders on success", async () => {
    jest.spyOn(OrderService, "getOrders").mockResolvedValue(mockOrders);

    const { result } = renderHook(() => useOrders(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockOrders);
  });
});
```

### 9.3 Mock Strategy

```ts
// __mocks__/services/OrderService.ts
// Mock at the service boundary, not at the HTTP layer

export const OrderService = {
  getOrders: jest.fn().mockResolvedValue([]),
  createOrder: jest.fn().mockResolvedValue(mockOrder),
  deleteOrder: jest.fn().mockResolvedValue(undefined),
};
```

Mock at the module boundary — mock your service layer, not axios itself. Keep mocks representative of real responses.

### 9.4 Detox E2E Testing

```ts
// e2e/flows/login.e2e.ts
describe("Login flow", () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should log in with valid credentials", async () => {
    await element(by.label("Email")).typeText("user@company.com");
    await element(by.label("Password")).typeText("correctpassword");
    await element(by.text("Sign in")).tap();

    await waitFor(element(by.text("Dashboard")))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

Test critical flows: login, main user journey, data sync. Run on CI for every PR against main.

### 9.5 Coverage Goals

| Layer                     | Target              | Rationale                       |
| ------------------------- | ------------------- | ------------------------------- |
| Business logic & services | 90%+                | Most critical, cheapest to test |
| Custom hooks              | 85%+                | Encapsulate complex logic       |
| UI components             | 70%+                | Test interaction, not rendering |
| Navigation                | 60%+                | Integration test level          |
| E2E flows                 | Critical paths only | Slow and expensive              |

Coverage % is a guide, not a goal. 100% coverage with poor tests is worse than 70% with good tests.

---

## 10. Build & Deployment

### 10.1 EAS Build Configuration

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "staging": {
      "distribution": "internal",
      "env": { "APP_ENV": "staging" },
      "ios": { "simulator": false }
    },
    "production": {
      "distribution": "store",
      "env": { "APP_ENV": "production" },
      "autoIncrement": true
    }
  }
}
```

Three build types, three bundle IDs — all three can co-exist on a device.

### 10.2 OTA Updates Strategy

```ts
// Using EAS Update for over-the-air JS bundle updates
import * as Updates from "expo-updates";

async function checkForUpdate() {
  if (!Updates.isEmbeddedLaunch) return;

  const update = await Updates.checkForUpdateAsync();
  if (update.isAvailable) {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // Mandatory for critical fixes
  }
}
```

OTA update policy guidance:

- **Critical bug fixes** → mandatory update, reload immediately
- **Feature additions** → optional, prompt user, apply on next launch
- **Hotfixes** → mandatory, show progress indicator

### 10.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test -- --coverage

  staging-build:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: eas build --platform all --profile staging --non-interactive

  production-build:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: eas build --platform all --profile production --non-interactive
      - run: eas submit --platform all --non-interactive
```

### 10.4 Version Management

```json
// app.json
{
  "expo": {
    "version": "1.4.2", // Semantic — shown to users
    "ios": {
      "buildNumber": "142" // Increments every CI build
    },
    "android": {
      "versionCode": 142 // Increments every CI build
    }
  }
}
```

Never reuse a build number — app stores reject duplicate build numbers.

### 10.5 Code Signing

Set up signing certificates in CI secrets — never on a developer's machine. When that developer leaves, builds should keep working.

```bash
# Store in GitHub Secrets:
# EXPO_TOKEN              — EAS authentication
# APPLE_ID                — App Store Connect
# APPLE_TEAM_ID           — Developer team
# ANDROID_KEYSTORE_BASE64 — Base64 encoded keystore
# ANDROID_KEY_ALIAS       — Keystore alias
# ANDROID_KEY_PASSWORD    — Key password
```

### 10.6 Release Checklist

- [ ] Version and build number incremented
- [ ] All three environments tested (dev / staging / prod)
- [ ] OTA update channel configured correctly
- [ ] Certificate expiry dates checked (both iOS and API pinning)
- [ ] Release notes written for App Store / Play Store
- [ ] Analytics and crash reporting verified in production build
- [ ] DB migrations verified on upgrade from previous version
- [ ] Remote wipe and force-logout tested

---

## Quick Reference — Technology Decisions

| Concern          | Recommended               | Avoid                                   |
| ---------------- | ------------------------- | --------------------------------------- |
| Local database   | WatermelonDB, expo-sqlite | AsyncStorage for structured data        |
| Global state     | Zustand                   | Redux (unless team uses it)             |
| Server state     | TanStack Query            | Manual fetch + useEffect                |
| Navigation       | React Navigation v6+      | React Native Navigation (unless needed) |
| HTTP client      | Axios with interceptors   | Raw fetch, multiple instances           |
| Secure storage   | react-native-keychain     | AsyncStorage for tokens                 |
| Images           | react-native-fast-image   | Image from RN core (no cache)           |
| Analytics        | Segment, Firebase         | Multiple uncoordinated SDKs             |
| Crash reporting  | Sentry                    | None                                    |
| E2E testing      | Detox                     | Manual QA only                          |
| Build automation | EAS Build / Fastlane      | Manual Xcode builds                     |
| JS engine        | Hermes (default RN 0.70+) | JavaScriptCore for new apps             |

---

_Last updated: April 2026 — React Native 0.74+, Expo SDK 50+_
