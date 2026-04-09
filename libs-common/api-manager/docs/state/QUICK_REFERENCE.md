# Quick Reference — API Integration Cheat Sheet

**TL;DR Decision Tree**

```
Am I fetching/caching server data?
  → YES: Use TanStack Query (useQuery/useMutation)
  → NO: Is it global state that needs persistence?
         → YES: Use Redux (useBaseStoreDispatch/Selector)
         → NO: Use useState (local component state)
```

---

## TanStack Query Cheat Sheet

### useQuery (Read Data)

```typescript
// Basic
const { data, isLoading, error } = useQuery({
  queryKey: ["resource", id],
  queryFn: async () => { const res = await fetch(); return res.data; },
});

// With TanStack options
const { data } = useQuery({
  ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
  staleTime: 1000 * 60 * 5,        // Cache 5 min
  enabled: !!id,                   // Conditional fetch
  refetchInterval: 10000,          // Poll every 10s
});

// Extract nested data
const items = data?.data?.data ?? [];
```

### useMutation (Write Data)

```typescript
// Basic
const { mutate, mutateAsync, isPending } = useMutation({
  mutationFn: async (data) => { const res = await fetch(); return res.data; },
  onSuccess: () => { toast.success("Done!"); },
  onError: (error) => { toast.error(error.message); },
});

// With TanStack options
const { mutateAsync } = useMutation(
  CREATE_SALUTATION.mutationOptions<SalutationResponse, CreateSalutationRequest>({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
    },
  })
);

// Call mutation
await mutateAsync({ salutationText: "Mr." });
```

---

## Redux Cheat Sheet

### useBaseStoreDispatch

```typescript
// Dispatch async action
const dispatch = useBaseStoreDispatch();

dispatch(loginAction({ bodyParam: { email, password } }))
  .unwrap()           // Convert to Promise
  .then((data) => {   // Success
    router.push("/dashboard");
  })
  .catch((err) => {   // Error
    setError(err.message);
  });
```

### useBaseStoreSelector

```typescript
// Select state (use granular selectors, not whole state)
const isLoading = useBaseStoreSelector((state) => state.auth.loginState.isLoading);
const user = useBaseStoreSelector((state) => state.auth.user);
const theme = useBaseStoreSelector((state) => state.ui.theme);

// ❌ DON'T do this (too broad)
const auth = useBaseStoreSelector((state) => state.auth);
```

---

## Lookups Module Quick Start

### 1. Fetch List

```typescript
import { useSalutations } from "@nks/api-manager";

const { data, isLoading } = useSalutations();
const items = data?.data?.data ?? [];  // Extract from nested response
```

### 2. Create Item

```typescript
import { useCreateSalutation, type CreateSalutationRequest } from "@nks/api-manager";

const { mutateAsync, isPending } = useCreateSalutation();

const formData: CreateSalutationRequest = {
  salutationText: "Dr.",
  description: "Doctor",
};

await mutateAsync(formData);
```

### 3. Update Item

```typescript
import { useUpdateSalutation, type UpdateSalutationRequest } from "@nks/api-manager";

const { mutateAsync, isPending } = useUpdateSalutation();

const formData: UpdateSalutationRequest = {
  salutationText: "Dr.",
  description: "Doctor",
};

await mutateAsync({ id: 1, ...formData });
```

### 4. Delete Item

```typescript
import { useDeleteSalutation } from "@nks/api-manager";

const { mutateAsync, isPending } = useDeleteSalutation();

await mutateAsync(1);  // Just pass the ID
```

### 5. CRUD with Cache

```typescript
import { useQueryClient } from "@tanstack/react-query";
import {
  useSalutations,
  useCreateSalutation,
  lookupKeys,
} from "@nks/api-manager";

const queryClient = useQueryClient();
const { data } = useSalutations();
const { mutateAsync } = useCreateSalutation();

const handleCreate = async (formData) => {
  await mutateAsync(formData);
  // Auto-refetch via mutation's onSuccess invalidation
};
```

---

## Common Patterns

### Pattern 1: Conditional Query

```typescript
// Only fetch if userId exists
const { data } = useUserRoles(userId, { enabled: !!userId });
```

### Pattern 2: Dependent Queries

```typescript
// Fetch store first, then products
const { data: store } = useStore(storeId);
const { data: products } = useProducts(
  { enabled: !!store?.data?.id }  // Wait for store
);
```

### Pattern 3: Manual Refetch

```typescript
const { data, refetch } = useSalutations();

const handleRefresh = () => {
  refetch();
};
```

### Pattern 4: Error Handling

```typescript
const { data, error, isError } = useSalutations();

return (
  <>
    {isError && <Alert>{error?.message}</Alert>}
    {data && <List items={data.data.data} />}
  </>
);
```

### Pattern 5: Loading State

```typescript
const { isLoading, isPending, isFetching } = useSalutations();

// isLoading = status is "pending" AND no cached data
// isPending = status is "pending" (even with cached data)
// isFetching = currently making request in background
```

### Pattern 6: Optimistic Update

```typescript
const { mutateAsync } = useUpdateSalutation();

mutateAsync(
  { id: 1, salutationText: "Dr." },
  {
    onMutate: async (newData) => {
      // Update UI optimistically
      await queryClient.cancelQueries({ queryKey: lookupKeys.salutations() });
      const old = queryClient.getQueryData(lookupKeys.salutations());
      queryClient.setQueryData(lookupKeys.salutations(), (data) => ({
        ...data,
        data: { ...data.data, ...newData },
      }));
      return { old };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(lookupKeys.salutations(), context.old);
    },
  }
);
```

---

## Stale Time Guide

```typescript
// Reference data (rarely changes) — cache longer
staleTime: 1000 * 60 * 5,      // 5 minutes
staleTime: 1000 * 60 * 60,     // 1 hour
staleTime: Infinity,            // Never stale

// User data (changes per session)
staleTime: 1000 * 60 * 5,      // 5 minutes

// Search results / dynamic data
staleTime: 1000 * 60 * 2,      // 2 minutes

// Real-time data
staleTime: 0,                   // Always stale
refetchInterval: 5000,          // Poll every 5 seconds
```

---

## File Imports

### From @nks/api-manager

```typescript
// Hooks (import only what you need)
import {
  useSalutations,
  useCreateSalutation,
  useUpdateSalutation,
  useDeleteSalutation,
  // ... 14 more mutation hooks
} from "@nks/api-manager";

// Types (import for component interfaces)
import type {
  SalutationsListResponse,
  SalutationResponse,
  CreateSalutationRequest,
  UpdateSalutationRequest,
} from "@nks/api-manager";
```

### From @nks/state-manager

```typescript
// Redux dispatch
import { useBaseStoreDispatch } from "@nks/state-manager";

// Redux selector
import { useBaseStoreSelector } from "@nks/state-manager";

// Actions
import { loginAction, registerAction } from "@nks/state-manager";
```

### From @tanstack/react-query

```typescript
// For cache management in mutations
import { useQueryClient } from "@tanstack/react-query";
import { useQuery, useMutation } from "@tanstack/react-query";
```

---

## Response Structure

```typescript
// What the API returns
{
  "status": "success",
  "message": "Salutations retrieved successfully",
  "data": {
    "data": [
      { id: 1, code: "MR", title: "Mr.", ... },
      { id: 2, code: "MRS", title: "Mrs.", ... },
    ],
    "message": "Salutations retrieved successfully"
  }
}

// How to extract
const items = response?.data?.data ?? [];
```

---

## Debugging Tips

### Check React Query DevTools

```typescript
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function App() {
  return (
    <>
      {/* Your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

### Log Query State

```typescript
const { data, status, fetchStatus } = useSalutations();
console.log({ data, status, fetchStatus });
// status: "pending" | "error" | "success"
// fetchStatus: "idle" | "fetching"
```

### Force Refetch

```typescript
const { refetch } = useSalutations();
await refetch();  // Skip cache, fresh fetch
```

---

## Common Errors & Fixes

### Error: "Property 'data' does not exist"

```typescript
// ❌ WRONG
const items = data.data.data;

// ✅ CORRECT (null-safe)
const items = data?.data?.data ?? [];
```

### Error: "Cannot read property 'mutateAsync'"

```typescript
// ❌ WRONG
const { mutate } = useMutation(...);
await mutate(data);  // mutate doesn't return Promise

// ✅ CORRECT
const { mutateAsync } = useMutation(...);
await mutateAsync(data);
```

### Error: "Query is fetching forever"

```typescript
// Check enabled condition
const { data } = useQuery({
  queryFn: ...,
  enabled: !!id,  // If id is undefined, query never runs
});

// Solution: Make sure enabled condition is true when you want to fetch
```

### Error: "Cache not updating after mutation"

```typescript
// ❌ WRONG
mutate(data);  // No invalidation

// ✅ CORRECT
await mutateAsync(data);  // Wait for mutation
queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });

// OR use hook's onSuccess
const mutation = useMutation(CREATE.mutationOptions({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
  },
}));
```

---

## Decision Checklist

- [ ] Is this server data from API? → useQuery/useMutation
- [ ] Is this global & needs persistence? → Redux
- [ ] Is this component-local UI state? → useState
- [ ] Does query need caching? → Set staleTime appropriately
- [ ] Does mutation change data? → Add invalidateQueries onSuccess
- [ ] Is query conditional? → Add enabled condition
- [ ] Do I need dependent queries? → Chain with enabled conditions
- [ ] Am I extracting nested data safely? → Use optional chaining (data?.data?.data)
- [ ] Have I typed request/response DTOs? → Import types from @nks/api-manager
- [ ] Have I tested error cases? → Check error handling in component

---

## Files to Read

1. **API_INTEGRATION_FINAL.md** — Complete guide (all concepts)
2. **LOOKUPS_INTEGRATION_GUIDE.md** — Lookups module specifics (examples)
3. **STATE_MANAGER_PATTERNS.md** — Redux vs TanStack (decision framework)

---

## Summary

| What | Use | Why |
|------|-----|-----|
| Fetch data | `useQuery()` | Caching, refetching, stale-while-revalidate |
| Create/Update/Delete | `useMutation()` | Side effects, cache invalidation |
| Login/Logout | Redux | Persistence, global access |
| Form inputs | `useState` | Component-scoped, temporary |
| Theme/Language | Redux | Persistence, global access |
| Modal open | `useState` | Component-scoped, temporary |
| User profile | Redux | Global, persisted, used everywhere |
| Search results | `useQuery()` | Cacheable, can vary per query |

---

## Next Steps

1. **Read** API_INTEGRATION_FINAL.md for concepts
2. **Reference** LOOKUPS_INTEGRATION_GUIDE.md when using lookups
3. **Consult** STATE_MANAGER_PATTERNS.md when unsure Redux vs TanStack
4. **Use** this Quick Reference for daily work
