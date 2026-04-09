# API Integration Final Guide — NKS Platform

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [APIData Pattern](#apidata-pattern)
3. [TanStack Query vs Redux](#tanstack-query-vs-redux)
4. [useQuery Deep Dive](#usequery-deep-dive)
5. [useMutation Deep Dive](#usemutation-deep-dive)
6. [State Manager Integration](#state-manager-integration)
7. [Real-World Examples](#real-world-examples)
8. [Decision Tree](#decision-tree)

---

## Quick Reference

| Scenario | Solution | Why |
|----------|----------|-----|
| **Fetch list/single resource** | `useQuery()` | Automatic caching, refetching, background updates |
| **Create/Update/Delete** | `useMutation()` + cache invalidation | Deterministic side effects, optimistic updates |
| **Auth state (login/logout/session)** | Redux (`useBaseStoreDispatch`) | Global state, persistence across tabs, deep nesting |
| **Form errors (inline)** | Local `useState` | Scoped to form, doesn't pollute global state |
| **Temporary UI state** | Local `useState` | canResend timer, showPassword, toast messages |
| **Admin-only features** | TanStack Query + cache invalidation | Clean, automatic cache management |
| **Real-time updates** | Query + polling/WebSocket | Refetch interval, manual invalidation |

---

## APIData Pattern

### Overview
`APIData` is a factory class that unifies API requests across Redux and TanStack Query.

**File**: `api-handler.ts`

```typescript
export class APIData {
  path: string;
  method: APIMethod;
  public?: boolean;  // for public endpoints (login, register)

  // Generates Redux async thunk
  generateAsyncThunk<T>(typePrefix: string)
  generateAsyncThunkV2<Returned, ThunkArg>(typePrefix: string)

  // TanStack Query support
  queryOptions<TResponse>(params?): Omit<UseQueryOptions<TResponse>, "enabled">
  mutationOptions<TResponse, TBody>(config?): UseMutationOptions<TResponse, Error, TBody>
}
```

### Key Methods

#### `queryOptions<TResponse>(params?)`
**Purpose**: Generate options for `useQuery()`

```typescript
// Returns UseQueryOptions with:
// - queryKey: auto-generated from path + params
// - queryFn: wraps routeMethod with error handling
// - No "enabled" (consumer adds it)

const salutationsQuery = GET_SALUTATIONS.queryOptions<SalutationsListResponse>();
// Returns: { queryKey: [...], queryFn: async () => {...}, ...config }
```

#### `mutationOptions<TResponse, TBody>(config?)`
**Purpose**: Generate options for `useMutation()`

```typescript
// Returns UseMutationOptions with:
// - mutationFn: wraps routeMethod, unwraps request body
// - merges custom config (onSuccess, onError, etc.)

const createQuery = CREATE_SALUTATION.mutationOptions<SalutationResponse, CreateSalutationRequest>({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
  },
});
```

---

## TanStack Query vs Redux

### When to Use TanStack Query

**Best for server state:**
- Fetching data from API
- Caching responses
- Automatic refetching (stale-while-revalidate)
- Mutations with invalidation
- Background syncing

**Example**: Fetching salutations list
```typescript
// ✅ TanStack Query — handles all caching automatically
export const useSalutations = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    queryKey: lookupKeys.salutations(),
    staleTime: 1000 * 60 * 5,  // 5 minutes
    enabled: options?.enabled ?? true,
  });
};

// Component
const { data, isLoading } = useSalutations();
const items = data?.data?.data ?? [];
```

### When to Use Redux

**Best for client state:**
- Authentication (user info, tokens, session)
- Global UI state (theme, sidebar collapsed)
- Deep nesting (user → store → role hierarchy)
- Persistence across browser tabs
- Navigation state

**Example**: Login flow
```typescript
// ✅ Redux — persists auth, survives tab close, deeply nested
const dispatch = useBaseStoreDispatch();
const isLoading = useBaseStoreSelector((state) => state.auth.loginState.isLoading);

const handleSubmit = form.handleSubmit(({ email, password }) => {
  dispatch(loginAction({ bodyParam: { email, password } }))
    .unwrap()
    .then((data) => {
      if (data?.data?.accessToken) {
        router.push("/dashboard");
      }
    })
    .catch((err) => setApiError(err?.message));
});
```

### Side-by-Side Comparison

```typescript
// ❌ WRONG — using Redux for simple list fetch
const dispatch = useBaseStoreDispatch();
const countries = useBaseStoreSelector((state) => state.lookups.countries);
useEffect(() => {
  dispatch(fetchCountries());  // Manual refetch logic needed
}, []);

// ✅ CORRECT — TanStack Query handles caching + refetch automatically
const { data } = useCountries();
const countries = data?.data?.data ?? [];
```

---

## useQuery Deep Dive

### Signature
```typescript
useQuery<TData = unknown, TError = Error, TQueryFnData = TData>({
  queryKey: QueryKey,
  queryFn: QueryFunction<TQueryFnData, QueryKey>,
  enabled?: boolean,
  staleTime?: number,  // time before cache is considered "stale"
  gcTime?: number,     // garbage collection time (keep in memory)
  refetchInterval?: number,
  refetchOnWindowFocus?: boolean,
  ...
}): UseQueryResult<TData, TError>
```

### Return Value
```typescript
{
  data: TData | undefined,
  error: TError | null,
  status: "pending" | "error" | "success",
  isLoading: boolean,     // status === "pending" AND no cached data
  isPending: boolean,     // status === "pending" (even with cached data)
  isFetching: boolean,    // actively fetching in background
  isError: boolean,
  isSuccess: boolean,
  failureCount: number,
  failureReason: TError | null,
  refetch: (options?) => Promise<UseQueryResult<TData, TError>>,
}
```

### Common Patterns

#### 1. **Conditional Fetching**
```typescript
const { id } = useParams();
const { data } = useQuery({
  ...getSalutation.queryOptions<SalutationResponse>({ pathParam: { id } }),
  enabled: !!id,  // Only fetch if id exists
});
```

#### 2. **Dependent Queries**
```typescript
const { data: store } = useStore(storeId);
const { data: products } = useProducts({
  enabled: !!store?.data?.id,  // Wait for store before fetching products
});
```

#### 3. **Refetch on Interval (Polling)**
```typescript
const { data } = useQuery({
  ...GET_NOTIFICATIONS.queryOptions<NotificationsResponse>(),
  refetchInterval: 5000,  // Poll every 5 seconds
});
```

#### 4. **Manual Refetch**
```typescript
const { data, refetch } = useQuery({
  ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
});

const handleRefresh = () => {
  refetch();  // Force re-fetch, ignoring cache
};
```

#### 5. **Stale Time Configuration**
```typescript
// Reference data (rarely changes)
export const useSalutations = () => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    staleTime: 1000 * 60 * 5,  // 5 minutes
  });
};

// Real-time data (changes frequently)
export const useNotifications = () => {
  return useQuery({
    ...GET_NOTIFICATIONS.queryOptions<NotificationsResponse>(),
    staleTime: 0,  // Always stale, refetch on mount
    refetchInterval: 3000,
  });
};

// Static data (never changes in session)
export const useCountries = () => {
  return useQuery({
    ...GET_COUNTRIES.queryOptions<CountriesListResponse>(),
    staleTime: Infinity,  // Never becomes stale
  });
};
```

#### 6. **Error Handling**
```typescript
const { data, error, isError } = useQuery({
  ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
});

return (
  <>
    {isError && <Alert>{error?.message}</Alert>}
    {data && <SalutationsList items={data.data.data} />}
  </>
);
```

---

## useMutation Deep Dive

### Signature
```typescript
useMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>({
  mutationFn: (variables: TVariables) => Promise<TData>,
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>,
  onError?: (error: TError, variables: TVariables, context?: TContext) => void,
  onSuccess?: (data: TData, variables: TVariables, context?: TContext) => void,
  onSettled?: (data: TData | undefined, error: TError | null) => void,
  retry?: boolean | number,
  ...
}): UseMutationResult<TData, TError, TVariables>
```

### Return Value
```typescript
{
  mutate: (variables: TVariables) => void,           // Fire and forget
  mutateAsync: (variables: TVariables) => Promise,  // Awaitable
  data: TData | undefined,
  error: TError | null,
  status: "idle" | "pending" | "error" | "success",
  isPending: boolean,
  isError: boolean,
  isSuccess: boolean,
  reset: () => void,
  failureCount: number,
}
```

### Common Patterns

#### 1. **Basic Mutation with Cache Invalidation**
```typescript
export const useCreateSalutation = () => {
  const queryClient = useQueryClient();

  return useMutation(
    CREATE_SALUTATION.mutationOptions<SalutationResponse, CreateSalutationRequest>({
      onSuccess: () => {
        // Invalidate cache, triggers automatic refetch
        queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
      },
    })
  );
};

// Usage
const { mutate } = useCreateSalutation();
const handleCreate = (data: CreateSalutationRequest) => {
  mutate(data, {
    onError: (err) => toast.error(err?.message),
    onSuccess: () => toast.success("Created!"),
  });
};
```

#### 2. **Optimistic Updates**
```typescript
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation(
    UPDATE_PRODUCT.mutationOptions<ProductResponse, UpdateProductRequest>({
      onMutate: async (newData) => {
        // Cancel ongoing refetch
        await queryClient.cancelQueries({ queryKey: lookupKeys.products() });

        // Get previous data
        const previousData = queryClient.getQueryData(lookupKeys.products());

        // Update cache optimistically
        queryClient.setQueryData(lookupKeys.products(), (old: any) => ({
          ...old,
          data: { ...old?.data, ...newData },
        }));

        return { previousData };  // Save for rollback
      },
      onError: (err, newData, context) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(lookupKeys.products(), context.previousData);
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.products() });
      },
    })
  );
};
```

#### 3. **Sequential Mutations**
```typescript
const { mutateAsync: createStore } = useCreateStore();
const { mutateAsync: createRole } = useCreateRole();

const handleSetupStore = async (storeData: CreateStoreRequest, roleData: CreateRoleRequest) => {
  try {
    const store = await createStore(storeData);
    const role = await createRole({ ...roleData, storeId: store.data.id });
    toast.success("Store created with role");
  } catch (err) {
    toast.error(err?.message);
  }
};
```

#### 4. **Form Submission with Inline Error**
```typescript
const { mutateAsync, isPending } = useCreateSalutation();

const handleSubmit = form.handleSubmit(async (formData) => {
  try {
    await mutateAsync({
      salutationText: formData.salutationText,
      description: formData.description,
    });
    form.reset();
  } catch (err) {
    setApiError(err?.message);
  }
});
```

#### 5. **Parallel Mutations**
```typescript
const mutation1 = useMutation(...);
const mutation2 = useMutation(...);

const handleParallel = async () => {
  await Promise.all([
    mutation1.mutateAsync(data1),
    mutation2.mutateAsync(data2),
  ]);
};
```

---

## State Manager Integration

### Redux Async Thunk Pattern

**When to use**: Auth flows, global state that spans multiple features

```typescript
// 1. Define the thunk
export const loginAction = createAsyncThunk(
  'auth/login',
  async (params: RequestParams<LoginRequest>, { rejectWithValue }) => {
    try {
      const response = await LOGIN.routeMethod(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data);
    }
  }
);

// 2. Use in reducer
const loginSlice = createSlice({
  name: 'login',
  initialState: { isLoading: false, data: null, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(loginAction.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loginAction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(loginAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// 3. Use in component
const dispatch = useBaseStoreDispatch();
const { isLoading, error } = useBaseStoreSelector((state) => state.auth.loginState);

dispatch(loginAction({ bodyParam: { email, password } }))
  .unwrap()
  .then((data) => { /* handle success */ })
  .catch((err) => { /* handle error */ });
```

### Combining Redux + TanStack Query

**Pattern**: Use Redux for auth, TanStack Query for everything else

```typescript
// ✅ CORRECT
const dispatch = useBaseStoreDispatch();
const user = useBaseStoreSelector((state) => state.auth.user);
const { data: stores } = useStores();  // TanStack Query

// ✅ NOT this
const user = useBaseStoreSelector((state) => state.auth.user);
const dispatch = useBaseStoreDispatch();
useEffect(() => {
  dispatch(fetchStores());  // ❌ Redux for server state is wrong
}, []);
```

---

## Real-World Examples

### Example 1: Lookups List with CRUD

```typescript
// hooks/use-salutations-crud.ts
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSalutations,
  useCreateSalutation,
  useUpdateSalutation,
  useDeleteSalutation,
  type CreateSalutationRequest,
  type UpdateSalutationRequest,
} from "@nks/api-manager";

export function useSalutationsCrud() {
  const queryClient = useQueryClient();

  // Query
  const { data, isLoading, refetch } = useSalutations();

  // Mutations
  const createMutation = useCreateSalutation();
  const updateMutation = useUpdateSalutation();
  const deleteMutation = useDeleteSalutation();

  // Local UI state
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const items = data?.data?.data ?? [];

  // Handlers
  const handleCreate = async (formData: CreateSalutationRequest) => {
    try {
      setApiError(null);
      await createMutation.mutateAsync(formData);
    } catch (err) {
      setApiError(err?.message ?? "Failed to create");
    }
  };

  const handleUpdate = async (id: number, formData: UpdateSalutationRequest) => {
    try {
      setApiError(null);
      await updateMutation.mutateAsync({ id, ...formData });
    } catch (err) {
      setApiError(err?.message ?? "Failed to update");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setApiError(null);
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      setApiError(err?.message ?? "Failed to delete");
    }
  };

  return {
    // Data
    items,
    isLoading,
    apiError,
    selectedItem,

    // Mutations
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Handlers
    setSelectedItem,
    handleCreate,
    handleUpdate,
    handleDelete,
    refetch,
  };
}
```

### Example 2: Login with Auth State

```typescript
// hooks/use-login-form.ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFields } from "../schema/login";
import { useBaseStoreDispatch, useBaseStoreSelector } from "@nks/state-manager";
import { loginAction } from "@nks/state-manager"; // Redux thunk

export function useLoginForm() {
  const router = useRouter();
  const dispatch = useBaseStoreDispatch();

  // Redux state (auth is global)
  const { isLoading, error } = useBaseStoreSelector(
    (state) => state.auth.loginState
  );

  // Local form state
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSubmit = form.handleSubmit(({ email, password }) => {
    dispatch(loginAction({ bodyParam: { email, password } }))
      .unwrap()
      .then((data) => {
        if (data?.data?.accessToken) {
          router.push("/dashboard");
        }
      })
      .catch((err) => {
        // Error is already in Redux state, component reads via selector
      });
  });

  return {
    form,
    isLoading,
    error,
    showPassword,
    setShowPassword,
    handleSubmit,
  };
}
```

### Example 3: Conditional Fetch

```typescript
// hooks/use-store-details.ts
"use client";

import { useParams } from "next/navigation";
import { useStore, useStoreRoles } from "@nks/api-manager";

export function useStoreDetails() {
  const { storeId } = useParams<{ storeId: string }>();

  // Fetch store
  const { data: store, isLoading: storeLoading } = useStore(
    storeId ? Number(storeId) : null,
    { enabled: !!storeId }  // Only fetch if storeId exists
  );

  // Fetch roles AFTER store is loaded
  const { data: roles, isLoading: rolesLoading } = useStoreRoles(
    store?.data?.id,
    { enabled: !!store?.data?.id }  // Only fetch if store loaded
  );

  return {
    store: store?.data,
    roles: roles?.data?.data ?? [],
    isLoading: storeLoading || rolesLoading,
  };
}
```

---

## Decision Tree

```
┌─ Is this SERVER state? (data from API)
│  ├─ YES ──→ Use TanStack Query (useQuery/useMutation)
│  │           - Automatic caching
│  │           - Background refetch
│  │           - Stale-while-revalidate
│  │           - Cache invalidation on mutations
│  │
│  └─ NO ──→ Is this CLIENT state?
│             ├─ YES ──→ Is it GLOBAL? (auth, theme, user)
│             │          ├─ YES ──→ Use Redux (useBaseStoreDispatch/Selector)
│             │          │          - Persisted across tabs
│             │          │          - Deep nesting support
│             │          │
│             │          └─ NO ──→ Use useState (local component state)
│             │                     - Form state
│             │                     - UI toggles
│             │                     - Temporary UI state
│             │
│             └─ NO ──→ Error: Unknown state type

┌─ Is this a QUERY (read operation)?
│  ├─ YES ──→ useQuery()
│  │           - GET /salutations
│  │           - GET /stores/:id
│  │           - Get any resource
│  │
│  └─ NO ──→ Is this a MUTATION (write operation)?
│             ├─ YES ──→ useMutation()
│             │          - POST /salutations
│             │          - PUT /salutations/:id
│             │          - DELETE /salutations/:id
│             │          - Any state-changing operation
│             │
│             └─ NO ──→ Error: Unknown operation type

┌─ Does the query need CACHING?
│  ├─ Reference data (salutations, countries)
│  │  └─ staleTime: 5-60 minutes
│  │     gcTime: Infinity (keep forever)
│  │
│  ├─ User data (profile, settings)
│  │  └─ staleTime: 5-10 minutes
│  │     gcTime: 10-30 minutes
│  │
│  ├─ Real-time data (notifications, orders)
│  │  └─ staleTime: 0 (always stale)
│  │     refetchInterval: 3-10 seconds
│  │
│  └─ One-time fetches (loading a single resource)
│     └─ staleTime: match use case
│        gcTime: 5 minutes (clean up after navigation)

┌─ Does the mutation need CACHE INVALIDATION?
│  ├─ YES ──→ Add onSuccess callback
│  │          queryClient.invalidateQueries({ queryKey: [...] })
│  │          - Create/Update/Delete operations
│  │
│  └─ NO ──→ Just mutate without invalidation
│             - Form submission with redirect
│             - One-off operations

```

---

## Summary Table

| Feature | Redux | TanStack Query |
|---------|-------|----------------|
| **Best For** | Auth, global UI state | Server data, caching |
| **Persistence** | Yes (localStorage) | No (memory only) |
| **Boilerplate** | High (thunks, slices) | Low (hooks only) |
| **Caching** | Manual | Automatic |
| **Refetching** | Manual | Automatic |
| **Error Handling** | In reducer | In hook + component |
| **Learning Curve** | Steep | Shallow |
| **Performance** | Good (whole state) | Excellent (granular) |

---

## Best Practices Checklist

- [ ] Use TanStack Query for ALL server state
- [ ] Use Redux ONLY for auth + global UI state
- [ ] Use useState for form-local and transient UI state
- [ ] Always add `enabled` conditions to queries
- [ ] Set appropriate `staleTime` based on data freshness needs
- [ ] Invalidate cache on mutations with `onSuccess`
- [ ] Use `.unwrap().then().catch()` with dispatch (never `await dispatch`)
- [ ] Keep Redux state minimal (don't duplicate TanStack data)
- [ ] Use granular selectors (`state.auth.user` not `state.auth`)
- [ ] Type all RequestParams and Response DTOs
- [ ] Test cache behavior, not Redux internals

