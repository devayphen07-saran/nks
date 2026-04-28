# Account & Store Selection Flow — Implementation Spec

## Overview

This document defines the corrected post-login flow for account type selection, business bootstrap, store routing, and the in-app store switcher. It supersedes the earlier `store-selection-flow.md` and reflects the finalized product decisions.

---

## Scope

| Area | Covered |
|------|---------|
| Post-login routing | Account type selection → business bootstrap → store routing |
| Store Decision Logic | Default store validation, fallback selection, store route loading |
| In-App Store Switcher | Modal with tabs, Switch Store, Set Default Store |
| Cold-start routing | App re-open with existing session |
| Backend guarantees | Single default store, first store auto-default |

---

## Full Flow Diagram

```
Login (OTP Verified)
        │
        ▼
Account Type Selection Screen (UI only — no API calls)
        │
        ├─ Personal ──────────────────────────────► Personal Dashboard
        │
        └─ Business
                │
                ▼
        Bootstrap Step (parallel)
        ┌───────────────────────────────────────────┐
        │  GET /auth/me     — validates session      │
        │  GET /stores/me   — returns store lists    │
        └───────────────────────────────────────────┘
                │
                ▼
        Store Decision Logic
                │
                ├─ No stores (myStores + invitedStores = 0)
                │        └─────────────────────────► New Store Form (STORE_SETUP)
                │
                └─ Stores exist
                         │
                         ├─ defaultStoreGuuid present + found in store list
                         │        │
                         │        └─ GET /routes/store/:guuid
                         │                 └─────────────────► Store Stack (STORE_HOME)
                         │
                         └─ defaultStoreGuuid missing or NOT in store list
                                  │
                                  └─ Pick first available store (myStores first)
                                           │
                                           ├─ PUT /stores/default (best-effort, non-blocking)
                                           │
                                           └─ GET /routes/store/:guuid
                                                    └──────────────► Store Stack (STORE_HOME)
```

---

## Step-by-Step Implementation

### 1. Account Type Selection Screen (UI only)

**Route:** `/(protected)/(onboarding)/account-type`

- Rendered immediately after OTP login via `persistLogin → router.push(ROUTES.ACCOUNT_TYPE)`
- No API calls happen on this screen itself
- Two options:
  - **Personal** → `router.replace(ROUTES.PERSONAL_DASHBOARD)` (no bootstrap needed)
  - **Business** → triggers the Bootstrap Step below

---

### 2. Bootstrap Step (Business path only)

**Purpose:** fetch the minimum data required to make a routing decision.

**Calls (parallel):**

```
Promise.all([
  dispatch(getMe()),         // GET /auth/me   — validates session, returns user profile
  dispatch(getMyStores({})), // GET /stores/me — returns { myStores, invitedStores }
])
```

**Error handling:**
- If `getMe()` rejects → session is invalid → axios interceptor handles redirect to login (no extra logic needed)
- If `getMyStores()` rejects → show inline error on AccountTypeScreen, allow retry

**UI state during bootstrap:**
- Business card shows loading indicator (`ActivityIndicator`)
- Both cards are non-interactive while loading
- Error message displayed below cards if bootstrap fails

---

### 3. Store Decision Logic

Runs immediately after bootstrap completes.

```
const allStores = [...myStores, ...invitedStores]

if (allStores.length === 0) {
  → Navigate to New Store Form (STORE_SETUP)
  return
}

const defaultGuuid = authState.authResponse?.context?.defaultStoreGuuid
const defaultStore = defaultGuuid
  ? allStores.find(s => s.guuid === defaultGuuid)
  : null

const targetStore = defaultStore ?? allStores[0]

if (!defaultStore) {
  dispatch(setDefaultStore({ storeGuuid: targetStore.guuid }))  // best-effort, .catch(() => {})
}

await dispatch(getStoreRoutes({ pathParam: { storeGuuid: targetStore.guuid } }))
dispatch(setActiveStore({ guuid: targetStore.guuid, name: targetStore.storeName }))
router.replace(ROUTES.STORE_HOME)
```

**Key rules:**
- `defaultStoreGuuid` is sourced from the login/refresh auth response in Redux — never mutated locally
- Validation is existence check: the guuid must appear in the `getMyStores()` response
- Fallback order: `myStores[0]` before `invitedStores[0]` (owner preference)
- `getStoreRoutes` result is stored automatically in the `routes` Redux slice (handled by `routesSlice` extraReducers)
- Navigation only happens after store routes are loaded — prevents a flash of empty navigation

---

### 4. Cold-Start Routing (`/(protected)/index.tsx`)

Handles app re-opens where the user is already authenticated.

```
if (isSuperAdmin)         → ROUTES.NO_ACCESS
if (!defaultStoreGuuid)   → ROUTES.ACCOUNT_TYPE   (re-run selection; handles both personal and new-business users)
else                      → ROUTES.STORE_HOME
```

The `StoreLayout` seeds `activeStoreGuuid` from `defaultStoreGuuid` on mount for cold-start cases where the Redux store slice has been reset.

---

## In-App Store Switcher (Inside Store Stack)

### Trigger

Accessible from:
- **Drawer** → "Switch Store" button (replaces current navigation to `StoreListScreen`)
- Opens as a `BottomSheetModal` — no navigation occurs

### Modal Structure

```
SwitchStoreModal
├─ BottomSheetModal (height: ~580)
│   ├─ Header: "Switch Store"
│   │
│   ├─ SegmentedTabs (showBottomLine)
│   │   ├─ "Own Stores"      (key: "own")
│   │   └─ "Invited Stores"  (key: "invited")
│   │
│   └─ FlatList (tab-filtered)
│       └─ StoreRow
│           ├─ Store icon + name + code
│           ├─ Default badge (★ if current default)
│           ├─ [Switch]       → setActiveStore + getStoreRoutes + close modal
│           └─ [Set Default]  → PUT /stores/default (best-effort)
```

### Props

```typescript
interface SwitchStoreModalProps {
  visible: boolean;
  onClose: () => void;
  currentDefaultGuuid: string | null | undefined;
  activeStoreGuuid: string | null;
}
```

### Switch Store action

```
1. dispatch(setActiveStore({ guuid, name }))
2. dispatch(getStoreRoutes({ pathParam: { storeGuuid: guuid } }))
3. close modal
```

Does NOT call `PUT /stores/default` — switching active store is a session-scoped action. The default is only changed when the user explicitly taps "Set Default".

### Set Default action

```
1. dispatch(setDefaultStore({ storeGuuid: guuid }))
2. Update local optimistic state (show star on new default, remove from old)
```

Backend enforces single-default constraint. Frontend optimistically updates the star badge.

---

## API Reference

| Action | Method | Endpoint | Thunk |
|--------|--------|----------|-------|
| Validate session | GET | `/auth/me` | `getMe()` |
| Fetch store list | GET | `/stores/me` | `getMyStores({})` |
| Fetch store routes | GET | `/routes/store/:storeGuuid` | `getStoreRoutes({ pathParam: { storeGuuid } })` |
| Set default store | PUT | `/stores/default` | `setDefaultStore({ storeGuuid })` |

**Note:** `getStoreRoutes` requires `pathParam` — the `:storeGuuid` segment in the path is resolved by `APIData.generatePath` using the `pathParam.storeGuuid` value.

---

## Redux State Changes

| Slice | Action | When |
|-------|--------|------|
| `store` (company slice) | `setActiveStore({ guuid, name })` | After selecting target store |
| `routes` slice | auto-updated by `getStoreRoutes.fulfilled` | After dispatching `getStoreRoutes` |
| `auth` slice | unchanged | `defaultStoreGuuid` stays as issued by server |

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `features/workspace/hooks/useBusinessBootstrap.ts` | Hook: parallel fetch → decision logic → routing |
| `features/store/SwitchStoreModal.tsx` | Bottom sheet with tabs, switch + set-default actions |

### Modified Files

| File | Change |
|------|--------|
| `features/workspace/AccountTypeScreen.tsx` | Wire `handleStore` to `useBusinessBootstrap().runBootstrap()`, add loading state |
| `features/store/StoreDrawerContent.tsx` | Replace `router.replace(STORE_LIST)` with modal open |
| `app/(protected)/index.tsx` | Change `!defaultStoreGuuid → STORE_SETUP` to `→ ACCOUNT_TYPE` |
| `libs-common/api-manager/src/lib/api-handler.ts` | Strip `:` prefix in `generatePath` for Express-style path params (**already done**) |

---

## Backend Guarantees (Do Not Re-implement on Frontend)

- The first store a user creates is automatically set as their default (`defaultStoreFk`) — no frontend logic needed for first-store auto-default
- `PUT /stores/default` atomically clears the previous default and sets the new one — frontend does not need to clear old default manually
- If a user is removed from a store, the next token refresh will reflect the updated context

---

## Error States

| State | Handling |
|-------|---------|
| Bootstrap fails (`getMyStores` error) | Show retry button on AccountTypeScreen, stay on same screen |
| `getStoreRoutes` fails | Show error, allow retry — do not navigate to Store Stack with empty routes |
| `setDefaultStore` fails | Silently revert optimistic UI in SwitchStoreModal, show brief toast |
| All stores removed while in Store Stack | Next app open hits cold-start routing → `ACCOUNT_TYPE` → bootstrap re-runs |

---

## Implementation Order

1. `api-handler.ts` path fix (done)
2. `useBusinessBootstrap.ts` hook
3. `AccountTypeScreen.tsx` wiring
4. `SwitchStoreModal.tsx` component
5. `StoreDrawerContent.tsx` modal integration
6. `app/(protected)/index.tsx` cold-start fix
