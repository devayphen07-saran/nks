# State Manager Patterns — Redux vs TanStack Query

**Decision Framework** — Which tool to use for different types of state

---

## Mental Model

### Three Types of State

```
┌──────────────────────────────────────────────────────────┐
│                        STATE                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. SERVER STATE                2. GLOBAL UI STATE       │
│  ├─ Data from API               ├─ Logged-in user       │
│  ├─ Cached responses            ├─ Auth tokens          │
│  ├─ Paginated results           ├─ Theme preference     │
│  └─ Search results              ├─ Language/locale      │
│                                 └─ Navigation state     │
│  ✅ Use: TanStack Query          ✅ Use: Redux          │
│                                                          │
│  3. LOCAL UI STATE               4. UNKNOWN?            │
│  ├─ Form input values           └─ Ask yourself: "If   │
│  ├─ Modal open/close               the browser closes   │
│  ├─ Dropdown expanded               or refreshes, does  │
│  ├─ Tooltip visible                 this state matter?" │
│  ├─ Show/hide password          ✅ Yes → Redux         │
│  └─ Toast notifications         ❌ No  → useState      │
│                                                          │
│  ✅ Use: useState                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Redux — When & Why

### When to Use Redux

Redux is best for **persistent, global, application-wide state** that needs to survive:
- Page refreshes
- Tab switching
- Route navigation
- Browser tab switching

### Redux Use Cases (NKS Platform)

#### 1. Authentication State
```typescript
// ✅ Redux — survives refresh, accessed globally
export const loginAction = createAsyncThunk(
  'auth/login',
  async (params: RequestParams<LoginRequest>) => {
    const response = await LOGIN.routeMethod(params);
    return response.data;  // { accessToken, refreshToken, user: {...} }
  }
);

const loginSlice = createSlice({
  name: 'login',
  initialState: {
    isLoading: false,
    data: null,
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAction.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loginAction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
        // Auto-save to localStorage (middleware handles this)
      })
      .addCase(loginAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Usage
const dispatch = useBaseStoreDispatch();
const { isLoading, error } = useBaseStoreSelector(
  (state) => state.auth.loginState
);

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

#### 2. Session Restoration
```typescript
// ✅ Redux — survives page refresh
export const restoreSessionAction = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await SESSION_VERIFY.routeMethod();
      return response.data;  // { user: {...}, permissions: [...] }
    } catch (error) {
      return rejectWithValue(error?.response?.data);
    }
  }
);

// On app init
useEffect(() => {
  dispatch(restoreSessionAction());
}, []);

// User survives page refresh because Redux persists
const user = useBaseStoreSelector((state) => state.auth.user);
```

#### 3. User Routes & Permissions
```typescript
// ✅ Redux — persisted, used in multiple components
export const fetchUserRoutesAction = createAsyncThunk(
  'routes/fetchUserRoutes',
  async (userId: number) => {
    const response = await GET_USER_ROUTES.routeMethod({ pathParam: { userId } });
    return response.data;  // { routes: [...], hasAccess: {...} }
  }
);

// Used by: Sidebar, Navigation Guard, Permission Checker
const routes = useBaseStoreSelector((state) => state.routes.userRoutes);
```

### Redux Pattern Template

```typescript
// Step 1: Define the thunk
export const myAsyncAction = createAsyncThunk(
  'domain/action',  // Unique prefix
  async (params: RequestParams<RequestType>) => {
    try {
      const response = await MY_ENDPOINT.routeMethod(params);
      return response.data;  // What to store
    } catch (error) {
      throw error;  // Will be caught by rejected case
    }
  }
);

// Step 2: Create the slice
const mySlice = createSlice({
  name: 'myDomain',
  initialState: {
    isLoading: false,
    data: null,
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(myAsyncAction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(myAsyncAction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(myAsyncAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Step 3: Use in component
const dispatch = useBaseStoreDispatch();
const { isLoading, data, error } = useBaseStoreSelector(
  (state) => state.myDomain
);

dispatch(myAsyncAction({ bodyParam: {...} }))
  .unwrap()
  .then((result) => {
    // Success
  })
  .catch((err) => {
    // Error
  });
```

---

## TanStack Query — When & Why

### When to Use TanStack Query

TanStack Query is best for **server state** with:
- Automatic caching
- Background refetching
- Stale-while-revalidate
- Cache invalidation on mutations
- Zero boilerplate

### TanStack Query Use Cases (NKS Platform)

#### 1. Fetching Lists
```typescript
// ✅ TanStack Query — automatic caching, no Redux boilerplate
export const useSalutations = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    queryKey: lookupKeys.salutations(),
    staleTime: 1000 * 60 * 5,  // Cache for 5 minutes
    enabled: options?.enabled ?? true,
  });
};

// Usage — no Redux, no dispatch
const { data, isLoading, error } = useSalutations();
const items = data?.data?.data ?? [];
```

#### 2. CRUD Operations
```typescript
// ✅ TanStack Query — mutations with auto-invalidation
export const useCreateSalutation = () => {
  const queryClient = useQueryClient();

  return useMutation(
    CREATE_SALUTATION.mutationOptions<SalutationResponse, CreateSalutationRequest>({
      onSuccess: () => {
        // Auto-refetch list after create
        queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
      },
    })
  );
};

// Usage
const { mutateAsync, isPending } = useCreateSalutation();
await mutateAsync({ salutationText: "Mr.", description: "Mister" });
// List automatically refetches ✅
```

#### 3. Search & Filtering
```typescript
// ✅ TanStack Query — different cache per query param
export const useSearchProducts = (query: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...SEARCH_PRODUCTS.queryOptions<SearchResultsResponse>({
      queryParam: `?q=${query}`,
    }),
    queryKey: ["products", "search", query],  // Different key per query
    staleTime: 1000 * 60 * 2,  // 2 minutes for search results
    enabled: (options?.enabled ?? true) && !!query,  // Only fetch if query exists
  });
};

// Usage
const [searchQuery, setSearchQuery] = useState("");
const { data, isLoading } = useSearchProducts(searchQuery, {
  enabled: searchQuery.length > 2,  // Only search if > 2 chars
});
```

#### 4. Conditional Fetching (Dependent Queries)
```typescript
// ✅ TanStack Query — wait for first query to finish
const { storeId } = useParams();

// First query
const { data: storeData, isLoading: storeLoading } = useStore(
  storeId ? Number(storeId) : null,
  { enabled: !!storeId }
);

// Second query — only after first completes
const { data: productsData, isLoading: productsLoading } = useProducts(
  storeData?.data?.id,
  { enabled: !!storeData?.data?.id }  // Wait for store
);

if (storeLoading || productsLoading) return <Spinner />;
```

#### 5. Polling / Real-time Updates
```typescript
// ✅ TanStack Query — auto-poll in background
export const useNotifications = () => {
  return useQuery({
    ...GET_NOTIFICATIONS.queryOptions<NotificationsResponse>(),
    staleTime: 0,  // Always stale
    refetchInterval: 5000,  // Poll every 5 seconds
  });
};

// Automatically polls in background, updates component
const { data } = useNotifications();
```

### TanStack Query Pattern Template

```typescript
// Step 1: Define the hook
export const useMyResource = (id?: number, options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_MY_RESOURCE.queryOptions<MyResourceResponse>({
      pathParam: { id },
    }),
    queryKey: ["my-resource", id],
    staleTime: 1000 * 60 * 5,  // 5 minutes
    enabled: (options?.enabled ?? true) && !!id,
  });
};

// Step 2: Use in component
const { data, isLoading, error, refetch } = useMyResource(id);

// Step 3: Display with null checks
if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
if (!data) return <Empty />;

return <YourComponent data={data} />;
```

---

## Side-by-Side Comparison

### Scenario: Fetch & Cache Salutations List

#### Redux Approach ❌ (Over-engineered)
```typescript
// 1. Create thunk
export const fetchSalutations = createAsyncThunk(
  'salutations/fetch',
  async () => {
    const response = await GET_SALUTATIONS.routeMethod();
    return response.data;
  }
);

// 2. Create slice
const salutationsSlice = createSlice({
  name: 'salutations',
  initialState: { isLoading: false, data: null, error: null },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSalutations.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchSalutations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(fetchSalutations.rejected, (state) => {
        state.isLoading = true;
        state.error = action.payload;
      });
  },
});

// 3. Dispatch in component
const dispatch = useBaseStoreDispatch();
useEffect(() => {
  dispatch(fetchSalutations());
}, []);

// 4. Select from state
const { data, isLoading } = useBaseStoreSelector(
  (state) => state.salutations
);

// Problems:
// - Manual cache invalidation needed
// - Manual refetch logic needed
// - Lot of boilerplate for simple data fetch
// - Difficult to manage stale data
```

#### TanStack Query Approach ✅ (Simple)
```typescript
// 1. Define hook
export const useSalutations = () => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    staleTime: 1000 * 60 * 5,
  });
};

// 2. Use in component (just call the hook)
const { data, isLoading } = useSalutations();

// Benefits:
// - Automatic caching for 5 minutes
// - Automatic refetch on window focus
// - Automatic background updates
// - Automatic garbage collection
// - One line of code
```

---

## Common Mistakes

### ❌ WRONG: Using Redux for Server State
```typescript
// ❌ DON'T DO THIS
const dispatch = useBaseStoreDispatch();
useEffect(() => {
  dispatch(fetchCountries());  // Manual fetch
}, []);

const countries = useBaseStoreSelector((state) => state.countries);
// Problems: no caching, manual refetch, manual invalidation
```

### ✅ CORRECT: Use TanStack Query
```typescript
// ✅ DO THIS
const { data } = useCountries();
// Automatic caching, refetch, invalidation
```

### ❌ WRONG: Using TanStack Query for Auth
```typescript
// ❌ DON'T DO THIS
const { data: user } = useQuery({
  queryFn: async () => {
    const response = await SESSION_VERIFY.routeMethod();
    return response.data;
  },
});

// Problems: not persisted across refreshes, lost on tab close
```

### ✅ CORRECT: Use Redux for Auth
```typescript
// ✅ DO THIS
const user = useBaseStoreSelector((state) => state.auth.user);
// Persisted via localStorage, survives refresh
```

### ❌ WRONG: Mixing Both for Same Data
```typescript
// ❌ DON'T DO THIS
const user = useBaseStoreSelector((state) => state.users.list);  // Redux
const { data: users } = useUsers();  // TanStack Query
// Now you have two sources of truth!
```

### ✅ CORRECT: Pick One
```typescript
// ✅ Server state → TanStack Query
const { data: users } = useUsers();

// ✅ Global client state → Redux
const theme = useBaseStoreSelector((state) => state.ui.theme);
```

---

## Decision Matrix

| Scenario | Tool | Why |
|----------|------|-----|
| **Fetch list from API** | TanStack Query | Automatic caching, refetch |
| **Login/Logout** | Redux | Persists across tabs, survives refresh |
| **Form input values** | useState | Scoped to component, no persistence needed |
| **User profile** | Redux | Accessed everywhere, persisted |
| **Product search results** | TanStack Query | Different cache per search term |
| **Theme preference** | Redux | Accessed everywhere, persisted |
| **Modal open/close** | useState | Local to component |
| **Notifications count** | Redux | Accessed in header, persisted |
| **Store list** | TanStack Query | Cacheable reference data |
| **Logged-in user ID** | Redux | Needed for routing, permissions |
| **Dropdown expanded** | useState | Temporary UI state |
| **Dark mode toggle** | Redux | Persisted preference |
| **Search bar query** | useState | Temporary, only in search component |
| **User roles & permissions** | Redux | Needed for auth guards, route protection |
| **Countries dropdown options** | TanStack Query | Cacheable, rarely changes |

---

## Integration Pattern

### Best Practice: Redux + TanStack Query Together

```typescript
// hooks/use-store-dashboard.ts
"use client";

import { useBaseStoreSelector } from "@nks/state-manager";
import { useStores, useStoreUsers } from "@nks/api-manager";

export function useStoreDashboard() {
  // ✅ Get auth from Redux (global)
  const user = useBaseStoreSelector((state) => state.auth.user);

  // ✅ Get stores from TanStack Query (server state)
  const { data: storesData, isLoading: storesLoading } = useStores(
    { enabled: !!user?.id }  // Only fetch if logged in
  );

  // ✅ Get users from TanStack Query (conditional)
  const { data: usersData, isLoading: usersLoading } = useStoreUsers(
    storesData?.data?.data?.[0]?.id,
    { enabled: !!storesData?.data?.data?.[0]?.id }  // Wait for store
  );

  return {
    user,  // From Redux
    stores: storesData?.data?.data ?? [],  // From TanStack
    users: usersData?.data?.data ?? [],  // From TanStack
    isLoading: storesLoading || usersLoading,
  };
}

// Component
export function StoreDashboard() {
  const { user, stores, users, isLoading } = useStoreDashboard();

  if (!user) return <LoginRequired />;
  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      <StoresList stores={stores} />
      <UsersList users={users} />
    </div>
  );
}
```

---

## Testing Implications

### Redux Testing
```typescript
// Test Redux state
describe("Auth", () => {
  it("should update user on login", async () => {
    const store = configureStore({
      reducer: { auth: authReducer },
    });

    await store.dispatch(loginAction({ bodyParam: {...} }));
    const state = store.getState();

    expect(state.auth.loginState.data?.user).toBeDefined();
  });
});
```

### TanStack Query Testing
```typescript
// Test TanStack Query
describe("useCountries", () => {
  it("should fetch countries", async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useCountries(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data?.data).toHaveLength(195);
  });
});
```

---

## Summary

| Feature | Redux | TanStack Query |
|---------|-------|----------------|
| **Persistence** | ✅ Yes | ❌ No |
| **Caching** | 🟡 Manual | ✅ Automatic |
| **Boilerplate** | ❌ High | ✅ Low |
| **Learning Curve** | ❌ Steep | ✅ Shallow |
| **Best For** | Client state, Auth | Server state, Data fetching |
| **API Integration** | Possible but verbose | Perfect fit |
| **Performance** | Good | Excellent |
| **Developer Experience** | Moderate | Excellent |

**Rule of Thumb:**
- **Auth, Global UI** → Redux
- **Server Data** → TanStack Query
- **Component UI** → useState

