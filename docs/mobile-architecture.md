# NKS Mobile App — Architecture Rules

> **Attach this file** to every AI-assisted mobile development session.
> Every rule here is non-negotiable unless explicitly overridden in the task.

---

## Table of Contents

1. [Stack & Packages](#1-stack--packages)
2. [Folder Structure](#2-folder-structure)
3. [Expo Router Patterns](#3-expo-router-patterns)
4. [Auth & Navigation System](#4-auth--navigation-system)
5. [State Management (Redux)](#5-state-management-redux)
6. [Styling Rules](#6-styling-rules)
7. [Component Library Reference](#7-component-library-reference)
8. [Mobile Utils Reference](#8-mobile-utils-reference)
9. [RBAC & Permission System](#9-rbac--permission-system)
10. [Module Folder Pattern](#10-module-folder-pattern)
11. [Rules Checklist](#11-rules-checklist)

---

## 1. Stack & Packages

| Concern | Package | Import from |
|---|---|---|
| Routing | Expo Router (file-based) | `expo-router` |
| State | Redux Toolkit | `@reduxjs/toolkit`, `react-redux` |
| Styling | styled-components | `styled-components/native` |
| Theme tokens | `@nks/mobile-theme` | Design tokens, ThemeProvider, hooks |
| UI components | `@nks/mobile-ui-components` | All shared components |
| API thunks | `@nks/api-manager` | All API calls (never raw axios in screens) |
| Shared state slices | `@nks/state-manager` | `authSlice`, `companySlice`, etc. |
| Mobile utilities | `@nks/mobile-utils` | `tokenManager`, device utils, storage |
| Secure storage | via `@nks/mobile-utils` | `tokenManager.persistSession`, `loadSession` |
| Forms | `react-hook-form` | All form inputs |

### Key Monorepo Paths

```
nks/
├── apps/nks-mobile/          ← Expo app (this app)
│   ├── app/                  ← Expo Router pages (route groups below)
│   ├── store.ts              ← Redux store + Axios lifecycle callbacks
│   ├── store/
│   │   └── authThunks.ts     ← initializeAuth, refreshSession, persistLogin, logoutThunk
│   ├── hooks/                ← App-level hooks (usePermission, useSessionRefresh, useRouteGuard)
│   └── components/           ← App-level shared components (PermissionGate)
├── libs-common/
│   ├── api-manager/          ← @nks/api-manager — all API endpoint definitions + thunks
│   └── state-manager/        ← @nks/state-manager — all Redux slices (authSlice, companySlice)
└── libs-mobile/
    ├── theme/                ← @nks/mobile-theme — design tokens + ThemeProvider
    ├── mobile-ui-components/ ← @nks/mobile-ui-components — shared UI components
    └── mobile-utils/         ← @nks/mobile-utils — tokenManager, device utils
```

---

## 2. Folder Structure

### App-level (`apps/nks-mobile/app/`)

```
app/
├── _layout.tsx               ← Root layout: providers + central auth redirect + useSessionRefresh
├── index.tsx                 ← Stub (returns null; routing handled by _layout.tsx)
├── (auth)/                   ← Public screens — no session required
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── register.tsx
│   ├── account-type.tsx      ← Post-registration onboarding (AUTHENTICATED allowed)
│   └── accept-invite.tsx     ← Invite acceptance (AUTHENTICATED allowed)
├── (workspace)/              ← Workspace selector (AUTHENTICATED required)
│   ├── _layout.tsx
│   └── index.tsx
├── (personal)/               ← Personal account tabs (AUTHENTICATED required)
│   ├── _layout.tsx
│   └── index.tsx
├── (store)/                  ← Store context (AUTHENTICATED required)
│   ├── _layout.tsx
│   ├── select.tsx            ← Store selector screen
│   └── (main)/               ← Active store tabs (permission-gated tabs)
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── products.tsx
│       ├── orders.tsx
│       ├── reports.tsx
│       ├── staff.tsx
│       └── settings.tsx
└── (store-setup)/            ← Store creation (AUTHENTICATED required)
    ├── _layout.tsx
    └── create.tsx
```

### Module folder pattern (`app/(store)/(main)/` example)

For any non-trivial feature screen, organize locally:

```
(main)/
├── products.tsx              ← Screen entry point (thin — composes components)
├── components/               ← Screen-specific components
│   ├── ProductCard.tsx
│   └── ProductFilter.tsx
└── hooks/                    ← Screen-specific hooks
    ├── useProductList.ts
    └── useProductFilters.ts
```

> **Rule**: Reusable components go in `apps/nks-mobile/components/`. Screen-specific components stay local in the screen's `components/` subfolder.

---

## 3. Expo Router Patterns

### Route Groups

| Group | Auth Required | Notes |
|---|---|---|
| `(auth)` | No | login, register. `account-type` and `accept-invite` are here but remain accessible when AUTHENTICATED (onboarding) |
| `(workspace)` | Yes | Workspace selector |
| `(personal)` | Yes | Personal account tabs |
| `(store)` | Yes | Store context |
| `(store-setup)` | Yes | Store creation flow |

### Navigation

```tsx
// ✅ Replace (removes from history)
router.replace("/(workspace)");

// ✅ Push (adds to history — use for drilldown)
router.push("/(store)/select");

// ✅ Go back
router.back();

// ✅ Typed href on Tabs.Screen (show/hide a tab)
<Tabs.Screen name="staff" options={{ href: canSeeStaff ? undefined : null }} />
// href: undefined → visible tab
// href: null → hidden tab (user cannot navigate to it)
```

### Never use `useEffect` to navigate between auth states

Auth gating is handled **centrally** in `app/_layout.tsx`. Do not add redirect logic in individual layouts or screens.

```tsx
// ❌ WRONG — scattered auth guards in layout files
useEffect(() => {
  if (!token) router.replace("/(auth)/login");
}, [token]);

// ✅ CORRECT — navigate explicitly only for in-app flow (not auth state)
const onSelectStore = (id: number) => {
  dispatch(companySlice.actions.selectCompany(id));
  router.replace("/(store)/(main)");
};
```

### Central Auth Redirect Logic (`app/_layout.tsx`)

The `InnerLayout` component handles all auth redirects based on the `status` state machine:

```
UNAUTHENTICATED + not in (auth) group             → /(auth)/login
AUTHENTICATED   + in (auth) but not onboarding    → /(workspace)  [login/register bounce]
AUTHENTICATED   + not in (auth) and not in app    → /(workspace)  [root index on boot]
```

`account-type` and `accept-invite` are **exempt** from the AUTHENTICATED→workspace redirect (onboarding flow).

---

## 4. Auth & Navigation System

### Auth Status Machine

```
INITIALIZING  →  AUTHENTICATED   (session found in SecureStore)
              →  UNAUTHENTICATED  (no session / expired)

AUTHENTICATED →  UNAUTHENTICATED  (logout or 401)
UNAUTHENTICATED → AUTHENTICATED  (login / register + persistLogin)
```

### Session Lifecycle

```
Boot
  └── initializeAuth()
        ├── tokenManager.loadSession()  ← reads SecureStore
        ├── If token found: setAuthenticated (immediate, no flash)
        └── If stale or permissions stripped: dispatch refreshSession() [background]

Login/Register
  └── persistLogin(authResponse, dispatch)
        ├── tokenManager.set(token)       ← in-memory
        ├── tokenManager.persistSession() ← SecureStore (with 2048-byte guard)
        └── dispatch(setAuthenticated)    ← Redux → _layout redirect fires

Foreground return (stale > 15 min)
  └── useSessionRefresh() in _layout.tsx
        └── dispatch(refreshSession())   ← background, non-blocking

403 response (permissions changed)
  └── axios interceptor → tokenManager.notifyRefresh()
        └── store.ts callback → dispatch(refreshSession())

401 response (session expired)
  └── axios interceptor → tokenManager.notifyExpired()
        └── store.ts callback → clearSession + dispatch(setUnauthenticated)

Logout
  └── dispatch(logoutThunk())
        ├── tokenManager.clear()
        ├── POST /auth/sign-out (best-effort)
        ├── tokenManager.clearSession()
        └── dispatch(setUnauthenticated)
```

### Key Auth Thunks

```typescript
import { initializeAuth, refreshSession, persistLogin, logoutThunk } from "../store/authThunks";

// After login/register API call:
await persistLogin(authResponse, dispatch);  // sets token + persists + dispatches AUTHENTICATED

// Background refresh (called automatically — rarely call manually):
dispatch(refreshSession());

// Logout:
dispatch(logoutThunk());
```

### Post-Registration Onboarding

Registration creates a BetterAuth session. After `register` thunk resolves:

1. Call `persistLogin(authResponse, dispatch)` if `authResponse.session.token` is present
2. Navigate to `/(auth)/account-type` (user stays on onboarding, NOT redirected to workspace)
3. After `setupPersonal` resolves: call `persistLogin` again (fresh permissions), navigate to `/(personal)`
4. After store creation: user is already AUTHENTICATED; navigate to `/(workspace)`

---

## 5. State Management (Redux)

### Store Shape

```typescript
{
  auth: {
    status: "INITIALIZING" | "UNAUTHENTICATED" | "AUTHENTICATED" | "LOCKED";
    user: AuthResponse | null;    // { user, session, access }
    error: string | null;
    fetchedAt: number;            // Date.now() of last successful session fetch
  };
  company: {
    selectedCompanyId: number | null;
    myStoresState: APIState;
    invitedStoresState: APIState;
    setupPersonalState: APIState;
    registerState: APIState;
    inviteStaffState: APIState;
    acceptInviteState: APIState;
    staffListState: APIState;
  };
}
```

### AuthResponse Shape

```typescript
interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  session: {
    token: string;        // Bearer token for API requests
    expiresAt: string;
    mechanism: "token";
  };
  access: {
    isSuperAdmin: boolean;
    tier: string;
    roles: string[];
    permissions: string[];  // e.g. ["products:read", "orders:manage"]
    companyId: number | null;
    userType: "SUPER_ADMIN" | "STORE_OWNER" | "STAFF" | "PERSONAL" | "UNSET";
  };
}
```

### Typed Hooks

```typescript
import { useAppDispatch, useAppSelector } from "../../store";

const dispatch = useAppDispatch();
const user = useAppSelector((state) => state.auth.user);
const status = useAppSelector((state) => state.auth.status);
const selectedCompanyId = useAppSelector((state) => state.company.selectedCompanyId);
```

### Stable Selector Pattern

```typescript
// ✅ Stable reference — define EMPTY outside the component
const EMPTY: any[] = [];
const stores = useAppSelector((state) => state.company.myStoresState.response ?? EMPTY);

// ❌ Creates a new array reference on every render — triggers re-render loop
const stores = useAppSelector((state) => state.company.myStoresState.response ?? []);
```

### Dispatching API Thunks

```typescript
// All API calls go through @nks/api-manager thunks
import { getMyStores, getInvitedStores } from "@nks/api-manager";

const result = await dispatch(getMyStores({}));
if (getMyStores.fulfilled.match(result)) {
  // result.payload.data → the response
}
```

---

## 6. Styling Rules

### Rule 1 — Always use styled-components (template literal syntax)

```tsx
// ✅ CORRECT
const Card = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
`;

// ❌ WRONG — object syntax
const Card = styled.View(({ theme }) => ({ backgroundColor: theme.colorBgContainer }));

// ❌ WRONG — inline style
<View style={{ padding: 16 }}>
```

### Rule 2 — No hardcoded values — use theme tokens

```tsx
// ✅ CORRECT
padding: ${({ theme }) => theme.sizing.medium}px;          // 16
border-radius: ${({ theme }) => theme.borderRadius.regular}px; // 8
background-color: ${({ theme }) => theme.colorPrimary};

// ❌ WRONG
padding: 16px;
border-radius: 8px;
background-color: #df005c;
```

### Rule 3 — Custom props use `$`-prefix

```tsx
// ✅ Prevents prop forwarding to native elements
const Chip = styled.TouchableOpacity<{ $active: boolean }>`
  background-color: ${({ $active, theme }) =>
    $active ? theme.colorPrimary : theme.colorBgLayout};
`;

<Chip $active={isSelected} onPress={...} />
```

### Rule 4 — File layout order

Every screen/component file must follow this order:

```
1. Imports
2. Types / Interfaces
3. Constants (stable references, option arrays)
4. Component function (exported)
5. Styled-components (always BELOW the component)
```

### Rule 5 — Screen background

```tsx
// Full-screen containers always use colorBgLayout
const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

// Card/surface elements use colorBgContainer
const Card = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
`;
```

---

## 7. Component Library Reference

> **Always check this list before building custom UI.** Use the existing component if it fits. If a component is missing, suggest creating it in `@nks/mobile-ui-components` and note it.

All imported from `@nks/mobile-ui-components`:

### Typography

```tsx
import { Typography } from "@nks/mobile-ui-components";

<Typography.H1 />   <Typography.H2 />   <Typography.H3 />
<Typography.H4 />   <Typography.H5 />   <Typography.Subtitle />
<Typography.Body /> <Typography.Caption /> <Typography.Overline />

// Props:
// weight: "normal" | "bold" | "medium" | "semiBold" | "light"  (NOT "regular")
// color: string  (theme token value)
// colorType: ColorType.primary | ColorType.danger | etc.
```

### Buttons

```tsx
<Button variant="primary" label="Submit" size="xlg" onPress={fn} loading={bool} />
// variant: "primary" | "default" | "dashed" | "text"
// size: "sm" | "md" | "lg" | "xlg"

<IconButton icon="edit" variant="primary" onPress={fn} />
```

### Form Inputs (all require `name` + `control` from react-hook-form)

```tsx
<Input name="email" control={control} label="Email" inputDataType="email" rules={...} />
<PasswordInput name="password" control={control} label="Password" />
<TextArea name="notes" control={control} label="Notes" />
<SearchInput value={q} onChangeText={setQ} placeholder="Search..." />
<CheckBox name="agree" control={control} label="I agree" />
<Switch name="enabled" control={control} label="Enabled" />
<RadioGroup name="type" control={control} options={[{ label, value }]} />
<SelectGeneric name="status" control={control} options={[{ label, value }]} />
```

### Layout Primitives

```tsx
import { Row, Column, Flex } from "@nks/mobile-ui-components";
```

**Always use `Row` / `Column` instead of plain `styled.View` for flex containers.**
Both accept sizing token keys (e.g. `"xSmall"`, `"medium"`) or raw numbers for spacing props.

```tsx
// Row — horizontal layout
<Row gap="small" align="center" justify="space-between">...</Row>

// Column — vertical layout (default)
<Column gap="xxSmall" padding="medium">...</Column>

// Flex — explicit direction control
<Flex direction="row" flex={1} gap="xSmall">...</Flex>
```

**Props reference:**

| Prop | Type | Example |
|---|---|---|
| `gap` | `SizeType key` or `number` | `gap="xSmall"` / `gap={8}` |
| `padding` | `SizeType key` or `number` | `padding="medium"` |
| `margin` | `SizeType key` or `number` | `margin="large"` |
| `align` | flexbox align-items | `align="center"` |
| `justify` | flexbox justify-content | `justify="space-between"` |
| `flex` | number | `flex={1}` |
| `bg` | theme key or hex | `bg="colorBgContainer"` |
| `radius` | number | `radius={8}` |
| `wrap` | `"wrap"` \| `"nowrap"` | `wrap="wrap"` |

**Extending with styled-components:**

```tsx
// ✅ Use styled(Column) / styled(Row) to add extra styles
const FormCard = styled(Column)`
  margin-left: ${({ theme }) => theme.sizing.medium}px;
  margin-right: ${({ theme }) => theme.sizing.medium}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

// Then pass Column/Row props alongside styled-component styles
<FormCard gap="xxSmall" padding="xLarge">...</FormCard>

// ❌ WRONG — use styled.View for flex containers
const FormFields = styled.View`
  flex-direction: column;
  gap: 8px;
`;
```

### Data Display

```tsx
<Avatar size="md" name="John Doe" />             // initials or image
<MetricCard title="Sales" value="$1,200" icon="trending-up" variant={ColorType.primary} />
<QuickActionButton label="View Orders" icon="package" onPress={fn} />
<Card>...</Card>                                  // elevated surface
<Tag label="Active" colorType={ColorType.success} />
<Divider />
<SectionHeader title="Recent Orders" />
<TitleDescription title="Store Name" description="MYSHOP01" />
<TitleWithIcon title="Products" icon="box" />
<ListRow label="Settings" onPress={fn} />
<GroupedMenu sections={[{ title, items: [{ label, onPress }] }]} />
```

### Lists

```tsx
<FlatListScaffold
  data={items}
  renderItem={({ item }) => <ItemCard ... />}
  onRefresh={fn}
  refreshing={bool}
  emptyMessage="No items found"
/>
<SkeletonLoader visible={isLoading} />
<NoDataContainer message="Nothing here yet" />
<FlatListLoading />
```

### Modals / Bottom Sheets

```tsx
<BaseModal visible={bool} onClose={fn}>...</BaseModal>
<BottomSheetModal visible={bool} onClose={fn} title="Select">...</BottomSheetModal>
<ModalSelect
  visible={bool}
  onClose={fn}
  options={[{ label, value }]}
  onSelect={fn}
  multi={false}
/>
<ModalHeader title="Edit Item" onClose={fn} />
```

### Navigation Components

```tsx
<Header title="Products" showBack />          // Screen header with SafeAreaView
<AppLayout>...</AppLayout>                    // Full-screen layout wrapper
<SegmentedTabs tabs={["Own", "Invited"]} activeIndex={i} onChange={fn} />
```

### Image

```tsx
<ImagePreview uri={url} width={200} height={200} />  // with fullscreen tap
<ImageWithoutPreview uri={url} width={200} height={200} />
```

### Icons

```tsx
import { LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

const { theme } = useMobileTheme();

<LucideIcon name="Package" size={20} color={theme.colorPrimary} />
<LucideIcon name="Store" size={34} color={theme.colorWhite} />
// Uses lucide-react-native — icon names are PascalCase (e.g. "Package", "Store", "ChevronRight")
// see https://lucide.dev for icon names
// Always use theme tokens for color — never hardcode strings like "#ffffff"
```

---

## 8. Mobile Utils Reference

All imported from `@nks/mobile-utils`:

### Token Manager

```typescript
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";

tokenManager.get()                    // → string | null  (in-memory token)
tokenManager.set(token)               // set in-memory token
tokenManager.clear()                  // wipe in-memory token
tokenManager.persistSession(data)     // save to SecureStore (2048-byte guard)
tokenManager.loadSession<T>()         // → { data: T, fetchedAt: number } | null
tokenManager.clearSession()           // wipe SecureStore
tokenManager.onExpired(cb)            // register 401 callback
tokenManager.onRefresh(cb)            // register 403 callback
```

> **SecureStore 2048-byte limit**: `persistSession` automatically strips `permissions[]` and `roles[]` if the payload is too large, and sets `fetchedAt = 0` so `initializeAuth` triggers an immediate background refresh.

### Device Utils

```typescript
import { getPlatform, isIOS, isAndroid } from "@nks/mobile-utils";
import { triggerHaptic } from "@nks/mobile-utils";
import { checkCameraPermission, requestCameraPermission } from "@nks/mobile-utils";
import { openExternalLink, openPhone, openEmail } from "@nks/mobile-utils";
```

### Media Utils

```typescript
import { compressImage, shareContent } from "@nks/mobile-utils";
```

### UI Utils

```typescript
import { copyToClipboard } from "@nks/mobile-utils";
import { dismissKeyboard } from "@nks/mobile-utils";
```

> **Before adding a utility to a screen**, search `@nks/mobile-utils` first. If the required util does not exist there, note it and ask to create it in `libs-mobile/mobile-utils/src/`.

---

## 9. RBAC & Permission System

### Access Data Shape

```typescript
state.auth.user?.access = {
  isSuperAdmin: boolean;   // bypasses all permission checks
  userType: "STORE_OWNER" | "STAFF" | "PERSONAL" | "UNSET" | "SUPER_ADMIN";
  roles: string[];
  permissions: string[];   // e.g. ["products:read", "orders:manage", "reports:read"]
  companyId: number | null;
}
```

### Permission Hooks

```typescript
import { usePermission, useAnyPermission, useAllPermissions } from "../hooks/usePermission";

// Single check (STORE_OWNER + isSuperAdmin bypass automatically)
const canRead = usePermission("products:read");

// Any of these
const canManage = useAnyPermission("orders:manage", "orders:read");

// All required
const canExport = useAllPermissions("reports:read", "reports:export");
```

### Route Guard

```typescript
import { useRouteGuard } from "../hooks/useRouteGuard";

export default function ReportsScreen() {
  const allowed = useRouteGuard("reports:read");
  if (!allowed) return null;  // redirect fires in background
  // ...
}
```

### PermissionGate Component

```tsx
import { PermissionGate } from "../components/PermissionGate";

// Hide a section
<PermissionGate permission="staff:manage">
  <StaffManagementSection />
</PermissionGate>

// With fallback
<PermissionGate permission="reports:export" fallback={<UpgradePrompt />}>
  <ExportButton />
</PermissionGate>
```

### Tab Visibility (Expo Router)

```tsx
// In (store)/(main)/_layout.tsx — permission-gated tabs
<Tabs.Screen
  name="products"
  options={{ href: canView("products:read") ? undefined : null }}
/>
// undefined → tab visible
// null → tab hidden (deep links still work — use useRouteGuard for screen-level security)
```

> ⚠️ **Tab hiding is UX only.** Every protected screen must call `useRouteGuard` independently. Users can bypass tabs via deep links.

### STORE_OWNER Bypass

`STORE_OWNER` has implicit access to all permissions — the hooks handle this automatically. Do not add manual `userType === "STORE_OWNER"` checks in screens; use `usePermission` instead.

---

## 10. Module Folder Pattern

When developing a new feature/module inside a route group, follow this structure:

```
app/(store)/(main)/products/
├── index.tsx               ← Screen entry (thin shell — routes data to components)
├── components/
│   ├── ProductCard.tsx     ← Module-specific card
│   ├── ProductFilter.tsx   ← Module-specific filter UI
│   └── ProductForm.tsx     ← Module-specific form
└── hooks/
    ├── useProductList.ts   ← Data fetching + loading/error state
    └── useProductForm.ts   ← Form logic
```

### Screen Entry (thin shell pattern)

```tsx
// index.tsx — orchestrate, don't implement
export default function ProductsScreen() {
  const allowed = useRouteGuard("products:read");
  if (!allowed) return null;

  return (
    <AppLayout>
      <Header title="Products" />
      <ProductFilter />
      <ProductList />
    </AppLayout>
  );
}
```

### Hook Pattern (data + state)

```typescript
// hooks/useProductList.ts
export function useProductList() {
  const dispatch = useAppDispatch();
  const products = useAppSelector((s) => s.products.listState.response ?? EMPTY);
  const isLoading = useAppSelector((s) => s.products.listState.isLoading);

  useEffect(() => { dispatch(getProducts({})); }, []);

  return { products, isLoading };
}
```

---

## 11. Rules Checklist

Before writing any screen or component:

### Navigation
- [ ] Auth redirect is NOT added to this screen — it lives only in `app/_layout.tsx`
- [ ] `router.replace` used for workspace switches, `router.push` for drilldown
- [ ] No `<Redirect>` inside layouts (use the central redirect in `_layout.tsx`)

### Components
- [ ] Checked `@nks/mobile-ui-components` catalogue before building custom UI
- [ ] `Row` / `Column` used instead of plain `styled.View` for flex containers — use `styled(Column)` / `styled(Row)` when extra styles are needed
- [ ] Typography uses `weight="normal"` (not `weight="regular"` — that value does not exist)
- [ ] `ColorType.xxx` used for variant props (not raw strings like `variant="primary"`)

### Styling
- [ ] Styled-components use **template literal** syntax (not object literal)
- [ ] Styled-components are **below** the component function in the file
- [ ] No hardcoded colors (`"#df005c"`, `"white"`, `"rgba()"`) — use `theme.*` tokens
- [ ] `LucideIcon` color uses `theme.*` token via `const { theme } = useMobileTheme()` — never a raw string
- [ ] `LucideIcon` name is PascalCase (e.g. `"Store"`, `"Package"`) not lowercase
- [ ] No inline `style={{ }}` props (exceptions: shadow objects, since styled-components doesn't support shadows well)
- [ ] Spacing uses `theme.sizing.*` tokens
- [ ] Border radius uses `theme.borderRadius.*` tokens
- [ ] Custom styled-component props use `$`-prefix

### State & Data
- [ ] API calls dispatched via `@nks/api-manager` thunks (never raw axios in screens)
- [ ] Stable `EMPTY` constant defined at module level for `?? []` fallbacks
- [ ] `useAppSelector` / `useAppDispatch` used (not raw `useSelector` / `useDispatch`)

### Auth & Permissions
- [ ] Protected screens call `useRouteGuard("permission:name")` and return null if denied
- [ ] `usePermission` used for conditional rendering (not manual `userType` checks)
- [ ] `persistLogin` called after login, register, and setupPersonal API responses

### Utilities
- [ ] Checked `@nks/mobile-utils` before adding a custom utility
- [ ] `tokenManager` used for all token reads/writes (never direct SecureStore calls)

### File Structure
- [ ] Module has `components/` subfolder for screen-specific components
- [ ] Module has `hooks/` subfolder for screen-specific data/logic hooks
- [ ] Reusable (cross-screen) components are in `apps/nks-mobile/components/`
- [ ] Reusable (cross-app) components are in `@nks/mobile-ui-components`
