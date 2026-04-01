# Redux Architecture — Books Web

This document covers the complete Redux setup: store configuration, slices, thunks, dispatch patterns, and usage in components.

---

## 1. Overview

The state management stack uses **Redux Toolkit (RTK)**. It is split across two packages:

| Package | Role |
|---|---|
| `@libs-common/state-manager` | Shared slices, base store, typed hooks |
| `@libs-common/api-handler` | `APIData` class that generates typed `AsyncThunk`s |
| `apps/web/books-web/src/store` | App-level store (extends base + adds app slices) |

---

## 2. Store Setup

### 2a. Base Store (`libs-common/state-manager/src/base-store.ts`)

A shared, reusable Redux store definition that any app can extend.

```ts
// base-store.ts
export const baseReducer = {
  user: userReducer,
  masterData: masterDataReducer,
};

export const baseStore = configureStore({
  reducer: baseReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "user/getUserDetails/fulfilled",
          "config/getAllConfig/fulfilled",
          // ...
        ],
      },
    }),
});

export type BaseStoreRootState = ReturnType<typeof baseStore.getState>;
export type BaseStoreDispatch = typeof baseStore.dispatch;

// Typed hooks
export const useBaseStoreDispatch = () => useDispatch<BaseStoreDispatch>();
export const useBaseStoreSelector: TypedUseSelectorHook<BaseStoreRootState> = useSelector;
```

### 2b. App-Level Store (`apps/web/books-web/src/store/index.ts`)

Extends the base store by spreading `baseReducer` and adding app-specific slices.

```ts
// store/index.ts
export const store = configureStore({
  reducer: {
    ...baseReducer,             // user + masterData
    configProperties: configSlice.reducer,  // app-specific
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActions: ["user/getUserDetails/fulfilled"] },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed dispatch & selector hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Convenience hook for books-specific state
export const useConfigPropertiesState = () =>
  useSelector((state: RootState) => state.configProperties);
```

### Store State Shape

```
RootState {
  user: UserState
  masterData: MasterDataState
  configProperties: ConfigPropertiesState  // books-specific
}
```

### 2c. Redux Provider (`apps/web/books-web/src/app/providers.tsx`)

The store is provided at the root with `<Provider>`. The layer order matters:

```tsx
<Provider store={store}>           // 1. Redux
  <QueryClientProvider client={...}> // 2. TanStack Query
    <AuthWrapper>                    // 3. Auth (connects store → AuthProvider)
      {children}
    </AuthWrapper>
  </QueryClientProvider>
</Provider>
```

`AuthWrapper` is an inner component that reads from the Redux store and passes it as props to `AuthProvider`, keeping `AuthProvider` store-agnostic.

```tsx
function AuthWrapper({ children }) {
  const dispatch = useAppDispatch();
  const userState = useAppSelector((state) => state.user);
  const masterDataState = useAppSelector((state) => state.masterData);

  return (
    <AuthProvider dispatch={dispatch} userState={userState} masterDataState={masterDataState}>
      {children}
    </AuthProvider>
  );
}
```

---

## 3. Slices

### 3a. User Slice (`libs-common/state-manager/src/slices/user-slice.ts`)

**State shape:**
```ts
interface UserState {
  profile: UserProfile | null;
  iamUserId: string | null;
  loading: boolean;
  error: SerializedApiError | null;
  isAuthenticated: boolean;
}
```

**Synchronous actions (reducers):**
| Action | Effect |
|---|---|
| `setIamUserId(id: string)` | Sets `state.iamUserId` from JWT decode |
| `clearUser()` | Resets profile, iamUserId, isAuthenticated, error to null/false |
| `clearError()` | Resets `state.error` to null |

**Async action (extraReducers via `addThunkCases`):**
| Thunk | Pending | Fulfilled | Rejected |
|---|---|---|---|
| `getUserDetails` | default `loading=true` | sets `profile`, `isAuthenticated=true` | `isAuthenticated=false`, clears profile on 401 |

**Exports:**
```ts
export { setIamUserId, clearUser, clearError };  // actions
export default userSlice.reducer;
```

---

### 3b. Master Data Slice (`libs-common/state-manager/src/slices/master-data-slice.ts`)

**State shape:**
```ts
interface MasterDataState {
  currencies: CurrencyModel[];
  currenciesLoading: boolean;
  currenciesError: SerializedApiError | null;

  countries: CountryModel[];
  countriesLoading: boolean;
  countriesError: SerializedApiError | null;

  configPropertiesState: ConfigPropertiesState;  // 50+ config category arrays
  loading: boolean;
  error: SerializedApiError | null;
  isInitialized: boolean;
}
```

**Synchronous actions:**
| Action | Effect |
|---|---|
| `clearMasterData()` | Resets entire state to `initialState` |
| `clearMasterDataError()` | Clears all error fields |

**Async thunks (3 total):**
| Thunk | Uses | Updates |
|---|---|---|
| `getAllCurrency` | `addThunkCases` with custom handlers | `currencies`, `currenciesLoading`, `currenciesError` |
| `getAllCountry` | `addThunkCases` with custom handlers | `countries`, `countriesLoading`, `countriesError` |
| `getAllConfig` | Raw `builder.addCase` (needs special processing) | All 50+ category arrays in `configPropertiesState` |

**Config processing:** On `getAllConfig.fulfilled`, the raw `ConfigMaster[]` array is:
1. Mapped to `ConfigMasterWithCodeValue[]` (`code` is used as `value`).
2. **Segregated into 50+ category-specific arrays** using `filterAndSort(config, CATEGORY_CONSTANT)`.
3. `isInitialized: true` is set once done.

---

## 4. Async Thunk Pattern

### 4a. How Thunks Are Created (`libs-common/api-handler/src/api-data.ts`)

The `APIData` class encapsulates an endpoint URL + HTTP method and generates typed `AsyncThunk`s.

```ts
const getUserDetailsAPI = new APIData("/iam/iamUserId/profile", APIMethod.GET);

// Generate a typed thunk
export const getUserDetails = getUserDetailsAPI.generateAsyncThunkV2<
  ApiResponse<UserProfile>,  // TResponse
  void                       // TBody (no request body)
>("user/getUserDetails");
```

**What `generateAsyncThunkV2` does internally:**
```ts
createAsyncThunk(typePrefix, async (param, { rejectWithValue, fulfillWithValue }) => {
  try {
    const data = await this.execute<TResponse, TBody>(param);
    return fulfillWithValue(data);
  } catch (error) {
    if (error instanceof ApiError) return rejectWithValue(error.toSerialized());
    return rejectWithValue(serializeApiError(error));
  }
});
```

All thunks use `rejectValue: SerializedApiError` for consistent error handling.

### 4b. `addThunkCases` Helper (`libs-common/api-handler/src/error-utils.ts`)

Reduces boilerplate for wiring thunk states into slices:

```ts
addThunkCases(builder, someThunk, {
  onPending: (state) => { state.loading = true; },
  onFulfilled: (state, response) => { state.data = response.body; },
  onRejected: (state, error) => { state.error = error; },
});
```

- If `onPending` is omitted → defaults to `state.loading = true; state.error = null`.
- Always sets `state.loading = false` on fulfilled/rejected.
- Always sets `state.error` from `rejectWithValue` on rejected.

### 4c. Pre-built Utilities

| Utility | Purpose |
|---|---|
| `addMultipleThunkCases(builder, [...])` | Wire multiple thunks in one call |
| `createCrudSlice(name, thunks)` | Auto-generate a slice with `list/selected/loading/error` + CRUD extra reducers |
| `createApiSelectors(sliceKey)` | Generate typed selectors `selectData`, `selectLoading`, `selectError` |
| `createCrudSelectors(sliceKey)` | Generate `selectList`, `selectSelected`, `selectLoading`, `selectError`, `selectHasData` |

---

## 5. Dispatch Patterns

### 5a. Synchronous Action

```ts
import { setIamUserId, clearUser } from "@libs-common/state-manager";
const dispatch = useAppDispatch();

dispatch(setIamUserId("some-iam-id"));
dispatch(clearUser());
```

### 5b. Async Thunk (with pathParam / bodyParam)

```ts
import { getUserDetails, getAllConfig } from "@libs-common/api-handler";

// Path param (resolves /iam/{iamUserId}/profile)
dispatch(getUserDetails({ pathParam: { iamUserId: "abc123" } }));

// Body param
dispatch(getAllConfig({ bodyParam: { categoryNames: initialCategoryNames } }));

// No params
dispatch(getAllCurrency());
dispatch(getAllCountry());
```

### 5c. Dispatch from Outside a Component (AuthProvider)

`AuthProvider` receives `dispatch` as a prop, not via `useDispatch`. This makes it store-agnostic and testable:

```tsx
// providers.tsx
const dispatch = useAppDispatch();  // get dispatch in a component

// pass to AuthProvider
<AuthProvider dispatch={dispatch} userState={...} ...>
```

---

## 6. State Access (Selectors)

### Pattern 1: `useAppSelector` (books-web app, full `RootState`)

```ts
import { useAppSelector } from "@/store";

// In a component
const { profile, isAuthenticated } = useAppSelector((state) => state.user);
const { currencies, countries } = useAppSelector((state) => state.masterData);
```

### Pattern 2: `useBaseStoreSelector` (shared components, only base state)

```ts
import { useBaseStoreSelector } from "@libs-common/state-manager";

const { profile } = useBaseStoreSelector((state) => state.user);
```

### Pattern 3: Convenience Hook (books-specific)

```ts
import { useConfigPropertiesState } from "@/store";

const { configPropertiesState } = useConfigPropertiesState();
```

---

## 7. Import Structure

### From `@libs-common/state-manager`
```ts
// Reducers for store composition
import { baseReducer } from "@libs-common/state-manager";

// Slice actions
import { setIamUserId, clearUser, clearError } from "@libs-common/state-manager";
import { clearMasterData, clearMasterDataError } from "@libs-common/state-manager";

// Types
import type { UserState, MasterDataState, ConfigPropertiesState } from "@libs-common/state-manager";

// Typed hooks (for shared components that don't know the full RootState)
import { useBaseStoreSelector, useBaseStoreDispatch } from "@libs-common/state-manager";

// Shared slices (configSlice, etc.)
import { configSlice } from "@libs-common/state-manager";
```

### From `@libs-common/api-handler`
```ts
// Async thunks
import { getUserDetails, getAllConfig, getAllCountry, getAllCurrency } from "@libs-common/api-handler";

// Slice helpers
import { addThunkCases, addMultipleThunkCases, createCrudSlice } from "@libs-common/api-handler";
import { ApiState, ApiListState, ApiCrudState } from "@libs-common/api-handler";
import type { SerializedApiError } from "@libs-common/api-handler";
```

### From `@/store` (books-web app only)
```ts
import { store, useAppDispatch, useAppSelector } from "@/store";
import type { RootState, AppDispatch } from "@/store";
```

---

## 8. Data Flow Summary

```
User visits page
      │
      ▼
AuthProvider.initAuth()
      ├── dispatch(setIamUserId) ← sync action
      ├── dispatch(getUserDetails) ← async thunk
      ├── dispatch(getAllCurrency) ← async thunk
      ├── dispatch(getAllCountry)  ← async thunk
      └── dispatch(getAllConfig)   ← async thunk
              │
              ▼
      each thunk → API call via APIData.execute()
              │
              ├── .pending  → state.loading = true
              ├── .fulfilled → update state (profile, currencies, etc.)
              └── .rejected → state.error = SerializedApiError

Component reads state:
  useAppSelector((state) => state.user.profile)
  useAppSelector((state) => state.masterData.currencies)
  useBaseStoreSelector((state) => state.user)  // shared components
```

---

## 9. Serializable Check Exceptions

RTK's middleware requires all state/actions to be serializable. Non-serializable payloads are whitelisted in `configureStore`:

```ts
serializableCheck: {
  ignoredActions: [
    "user/getUserDetails/fulfilled",   // UserProfile may contain Date objects
    "config/getAllConfig/fulfilled",
    "config/getAllCountry/fulfilled",
    "config/getAllCurrency/fulfilled",
  ],
}
```
