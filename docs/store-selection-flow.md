# Store Selection Flow

## Overview

After login, the app navigates the user to their default store context. The flow uses `users.defaultStoreFk` (persistent preference) and `session.activeStoreFk` (working context) to minimize friction for returning users while handling multi-store scenarios cleanly.

**Key endpoints:**
- `GET /stores/me` — returns `{ myStores: StoreDto[], invitedStores: StoreDto[] }`
- `PUT /stores/default { storeGuuid }` — sets persistent default store
- Auth response includes `session.defaultStore: { guuid } | null`

---

## After Login

### Case 1: Default store exists

- Auth response has `session.defaultStore.guuid`
- Seed `activeStoreFk` from it
- Navigate directly to that store's home screen
- No picker, no delay

### Case 2: No default, user has exactly 1 store

- Fetch `GET /stores/me` — returns 1 store total (myStores + invitedStores combined)
- Auto-enter that store immediately
- Fire `PUT /stores/default { storeGuuid }` in background (don't block navigation)
- Next login hits Case 1

### Case 3: No default, user has multiple stores

- Show `StorePickerScreen` (one-time, until default is set)
- Two sections:
  - **My Stores** — stores the user owns (owner badge)
  - **Invited Stores** — stores the user is staff in (staff badge)
- User taps a store:
  1. Call `PUT /stores/default { storeGuuid }`
  2. Set `activeStoreId` locally
  3. Navigate to that store's home screen
- Next login hits Case 1

### Case 4: User has 0 stores

- Show `CreateFirstStoreScreen`
- After store creation, auto-set as default and enter

---

## On Every App Open

Runs on app foreground, not just after login:

1. Fetch `GET /stores/me`, cache result to op-sqlite `stores` table
2. **Stale default guard:** check if `defaultStore.guuid` is still in the returned list
3. If **not found** (user removed from store, or store deleted):
   - Clear default locally
   - Redirect to `StorePickerScreen`
4. **Backend safety net:** `refreshAccessToken` already re-validates `activeStoreFk` against current user roles — unauthorized store-scoped API calls are blocked server-side even if the mobile cache is stale

---

## In-App Store Switcher

Accessible from the header (tap store name or avatar):

- Opens a **bottom sheet**
- Two sections: **My Stores** + **Invited Stores**
- Active store has a **checkmark**
- Tapping a different store:
  1. `PUT /stores/default { storeGuuid }` — persist new default
  2. Update `activeStoreId` locally
  3. Reload all store-scoped data
- **"Manage Stores"** link at bottom — navigates to full `StoreListScreen` (browse all stores, not the entry point)

---

## Settings

- **"Clear default store"** option available
- Clearing it means next app open shows `StorePickerScreen`

---

## Offline Behavior

- `GET /stores/me` response cached in op-sqlite `stores` table
- If offline, render store list / switcher from cache
- Show **"last synced"** indicator
- Navigation still works — `defaultStore.guuid` is persisted locally, store home renders from cached data

---

## Data Flow Summary

```
Login
  │
  ├─ defaultStore != null ──────────────────► Store Home (direct)
  │
  ├─ defaultStore == null, 1 store ─────────► Store Home (auto-enter)
  │                                            └─ PUT /stores/default (background)
  │
  ├─ defaultStore == null, multiple stores ─► StorePickerScreen
  │                                            └─ User taps → PUT /stores/default → Store Home
  │
  └─ 0 stores ─────────────────────────────► CreateFirstStoreScreen
```

```
App Open (returning)
  │
  ├─ GET /stores/me → cache to op-sqlite
  │
  ├─ defaultStore.guuid in list? ──► Continue to Store Home
  │
  └─ defaultStore.guuid NOT in list? ──► Clear default → StorePickerScreen
```

```
Store Switcher (header)
  │
  ├─ Tap different store
  │     ├─ PUT /stores/default
  │     ├─ Update activeStoreId
  │     └─ Reload store-scoped data
  │
  └─ "Manage Stores" → Full StoreListScreen
```

---

## Store List Item UI

| Element | Description |
|---------|-------------|
| Store name | Bold, primary text |
| Store code | Subtitle, muted |
| Badge | "Owner" or "Staff" |
| Default indicator | Star icon if store === defaultStore.guuid |
| Active indicator | Checkmark if store === activeStoreId (in switcher) |
| Chevron | Right arrow for navigation |

---

## Backend Validation

- `PUT /stores/default` validates user belongs to the store (owner or staff)
- `setDefaultStore` service checks store exists, is active, not deleted
- `refreshAccessToken` re-validates `activeStoreFk` against current roles on every token refresh
- `createSessionForUser` seeds `activeStoreFk` from `defaultStoreFk` only if user still has a role in that store
