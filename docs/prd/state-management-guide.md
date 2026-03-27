# State Management Guide
## NKS Mobile — When to Use What

> Architecture decision record for state management in the NKS offline-first POS app.

---

## The Three Tools Available

| Tool | You Have | Purpose |
|---|---|---|
| **Redux Toolkit (RTK)** | `@nks/state-manager` + `@nks/api-manager` | Global client state + async thunks |
| **TanStack Query** | Not installed yet | Server state — fetch, cache, sync |
| **React Context / Provider** | Built-in React | Dependency injection — stable, shared instances |

---

## The Core Mental Model

Before choosing a tool, ask one question:

```
Where does this data live?
  │
  ├── On the SERVER (fetched over network)?
  │     └── TanStack Query
  │
  ├── On the CLIENT (global, shared across screens)?
  │     └── Redux Toolkit
  │
  ├── In LOCAL SQLITE (WatermelonDB)?
  │     └── WatermelonDB + withObservables (reactive queries)
  │
  └── A STABLE INSTANCE / CONFIG (never or rarely changes)?
        └── React Context / Provider
```

---

## 1. TanStack Query — Server State

### What it is
A server-state library. It fetches data from an API, caches it, keeps it fresh in the background, and handles loading/error/refetch automatically.

### When to use it in NKS

| Screen / Data | Why TanStack Query |
|---|---|
| Sales history list (admin) | Server-paginated, needs `useInfiniteQuery`, background refetch on focus |
| Dashboard / reports | Server-computed analytics, stale after 5 min, no local copy needed |
| User profile (from server) | Fetch once, background update, no need in Redux |
| Inventory stock levels (admin view) | Read-only server data, needs periodic refetch |
| Customer search (online mode) | Server search with debounce, cache results per query key |
| Invoice PDF download URL | Short-lived URL from server, no persistence needed |

### Pros
- **Zero boilerplate** — no action, no reducer, no slice. Just `useQuery`.
- **Automatic cache** — same query across components shares one fetch.
- **Background refetch** — data stays fresh when app comes to foreground.
- **Stale-while-revalidate** — shows cached data immediately, updates silently.
- **Built-in pagination** — `useInfiniteQuery` for paginated lists.
- **Deduplication** — 10 components using the same key = 1 network request.
- **Optimistic updates** — built-in pattern for instant UI feedback.
- **DevTools** — React Query DevTools shows cache state clearly.

### Cons
- **Not offline-first** — cache is in-memory, lost on app restart by default.
- **Not for mutations that go to outbox** — `useMutation` expects a direct API call, not a local write.
- **Not for global UI state** — cart, connectivity, auth — these are not "server data."
- **Adds bundle size** — ~13KB gzipped.

### How it works with NKS
```typescript
// Sales history — perfect use case
const { data, isLoading, fetchNextPage } = useInfiniteQuery({
  queryKey: ['sales', shopId],
  queryFn: ({ pageParam = 1 }) =>
    apiGet(`v1/shops/${shopId}/sales?page=${pageParam}`),
  getNextPageParam: (last) => last.meta.page + 1,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Rule
> Use TanStack Query for anything that is **read from the server** and displayed in a list or detail screen where freshness matters.

---

## 2. Redux Toolkit — Global Client State

### What it is
A predictable global state container. RTK is the standard way to use Redux. The NKS `@nks/state-manager` and `@nks/api-manager` packages are built on this.

### When to use it in NKS

| State | Slice | Why RTK |
|---|---|---|
| Auth (token, user, isAuthenticated) | `authSlice` | Global, affects routing, shared by every screen |
| Cart (items, totals, payment method) | `cartSlice` | High-frequency updates, computed totals, no network |
| Connectivity (ONLINE/DEGRADED/OFFLINE) | `connectivitySlice` | Broadcast to all components including OutboxWorker |
| Sync status (pending count, last sync) | `syncStatusSlice` | Badge indicator, drives OutboxWorker decisions |
| Shop config (GST, invoice prefix) | `shopConfigSlice` | Loaded once on login, used by every sale |
| API loading/error states | All slices via extraReducers | `pending` / `fulfilled` / `rejected` per thunk |

### Pros
- **Synchronous** — state updates are instant, no async overhead.
- **Predictable** — single source of truth, time-travel debugging in Redux DevTools.
- **Cross-component coordination** — OutboxWorker reads `connectivity.status` from Redux to decide whether to drain the queue.
- **Persistent** — can be persisted to `AsyncStorage` via `redux-persist`.
- **Middleware** — logging, analytics, offline detection all plug in cleanly.
- **Typed selectors** — `useSelector((s: RootState) => s.cart)` is fully typed.
- **Already built** — `@nks/state-manager` is the pattern in use.

### Cons
- **Boilerplate** — model + slice + extraReducers per feature.
- **Not for server data** — using RTK for paginated server lists creates unnecessary complexity vs TanStack Query.
- **Not for local SQLite** — WatermelonDB has its own reactive system, RTK is redundant for that layer.
- **Over-normalization** — storing server responses in Redux then syncing with WatermelonDB creates two sources of truth.

### The critical flow — why Cart must be RTK
```
User taps product
    ↓
dispatch(addItem(item))         ← synchronous RTK reducer, instant UI update
    ↓
User taps "Charge ₹450"
    ↓
dispatch(completeSale(sale))    ← RTK thunk writes to WatermelonDB outbox
    ↓
completeSale.fulfilled          ← RTK marks isLoading = false
    ↓
dispatch(clearCart())           ← RTK clears cart state
```
At no point does any server call happen. TanStack Query cannot model this flow.

### Rule
> Use RTK for state that is **global, synchronous, drives UI across multiple screens, or coordinates background workers** (OutboxWorker, ConnectivityProbe).

---

## 3. React Context / Provider — Dependency Injection

### What it is
React's built-in mechanism for sharing a value down the component tree without prop drilling. Best for **stable values** — instances, configs, or state that changes very rarely.

### When to use it in NKS

| Provider | What it provides | Why not RTK/TanStack |
|---|---|---|
| `DatabaseProvider` | WatermelonDB `database` instance | Single instance, never changes, pure DI |
| `MobileThemeProvider` | Theme tokens, dark/light mode | Stable, CSS-in-JS, changes only on user toggle |
| `I18nProvider` | Translation function `t()` | Loaded once, never mutates during session |
| `SafeAreaProvider` | Insets | Pure RN infrastructure |
| `QueryClientProvider` | TanStack Query client | Infrastructure, not state |

### Pros
- **Zero dependencies** — built into React.
- **Perfect for instances** — database, query client, theme — these are objects, not state.
- **No re-render storm** — if the value never changes, consumers never re-render.
- **Simple mental model** — just `useContext(DatabaseContext)`.

### Cons
- **Re-renders all consumers** — if you put frequently-changing state in Context, every component that calls `useContext` re-renders. This is why cart, connectivity, and auth should NOT be in Context.
- **No DevTools** — you can't inspect Context state history.
- **No middleware** — can't intercept or log Context changes.
- **Boilerplate scales poorly** — 10 Context providers = "provider hell."

### The re-render problem — why NOT to use Context for cart
```typescript
// BAD — every component using useCartContext re-renders on every addItem
const CartContext = createContext<CartState>({ items: [], total: 0 });

// GOOD — only components that select from cart re-render
const items = useSelector((s: RootState) => s.cart.items);
```

### Rule
> Use Context only for **stable, singleton values** that are injected as infrastructure — not for state that changes during user interaction.

---

## 4. WatermelonDB + withObservables — Local SQLite State

This is the fourth player that many miss. For NKS's offline-first architecture:

### When to use it

| Data | Why WatermelonDB |
|---|---|
| Product catalog (POS screen) | Synchronous JSI reads, reactive to inventory changes |
| Outbox events | Source of truth for sync queue |
| Local sales records | Written before server sync |
| Customer local cache | Available offline |

### How it integrates with RTK
WatermelonDB handles **persistence and reactivity for local data**. RTK handles **coordination and UI state**. They work at different layers:

```
WatermelonDB (SQLite)       ← source of truth for local data
      ↓  (observe())
withObservables / useQuery  ← reactive, auto-updates component
      ↓
Component renders           ← no RTK involved for read path

OutboxWorker
      ↓  (reads outbox from WatermelonDB)
POST /sync/outbox
      ↓  (on success)
dispatch(setSyncCounts())   ← RTK updates the badge count
```

---

## 5. The Complete Decision Table for NKS

| State | Tool | Persisted? | Notes |
|---|---|---|---|
| `isAuthenticated`, access token | RTK + `redux-persist` | Yes (AsyncStorage) | Drives app routing |
| User profile (local copy) | RTK | Yes | Loaded on login |
| Cart items and totals | RTK | No | Session only, cleared after sale |
| Payment method selection | RTK | No | Per-sale |
| Connectivity status | RTK | No | Updated by ConnectivityProbe every 30s |
| Outbox pending count (badge) | RTK | No | Updated by OutboxWorker |
| Last sync timestamp | RTK | Yes | Shown in UI |
| Shop config (GST, prefix) | RTK + `redux-persist` | Yes | Loaded once on login |
| Product list (POS catalog) | WatermelonDB | Yes (SQLite) | JSI sync reads |
| Outbox events queue | WatermelonDB | Yes (SQLite) | Source of truth for sync |
| Local sales records | WatermelonDB | Yes (SQLite) | Before server confirmation |
| Sales history (server) | TanStack Query | No (memory cache) | Infinite scroll |
| Dashboard / reports | TanStack Query | No | Stale after 5min |
| User profile (server fresh) | TanStack Query | No | Background update |
| Customer server search | TanStack Query | No | Debounced, paginated |
| Database instance | Context | N/A | Pure DI |
| Theme tokens | Context | N/A | Pure DI |
| i18n `t()` function | Context | N/A | Pure DI |
| Form state (product form) | react-hook-form | No | Already in deps |

---

## 6. The `_layout.tsx` Provider Stack (correct order)

```typescript
export default function RootLayout() {
  return (
    // 1. RTK store — global state (outermost, everything needs it)
    <Provider store={nksStore}>

      // 2. TanStack Query — server cache
      <QueryClientProvider client={queryClient}>

        // 3. WatermelonDB — local SQLite instance
        <DatabaseProvider>

          // 4. Background workers (renderless)
          <ConnectivityProbe />
          <OutboxWorker />

          // 5. Pure UI infrastructure
          <SafeAreaProvider>
            <I18nProvider>
              <MobileThemeProvider>
                <Stack />
              </MobileThemeProvider>
            </I18nProvider>
          </SafeAreaProvider>

        </DatabaseProvider>
      </QueryClientProvider>
    </Provider>
  );
}
```

**Why this order:**
- RTK store is outermost — everything may need to dispatch
- QueryClientProvider inside RTK — TanStack Query mutations can dispatch to RTK after success
- DatabaseProvider inside both — OutboxWorker reads DB and dispatches to RTK
- Workers before UI — they start running immediately on mount before any screen renders

---

## 7. Common Mistakes to Avoid

### Mistake 1: Putting server list data in RTK
```typescript
// BAD — storing paginated server data in RTK
salesHistorySlice → { response: SaleModel[], isLoading: boolean }
dispatch(getSaleHistory())

// GOOD — TanStack Query handles server lists
useInfiniteQuery({ queryKey: ['sales'], queryFn: fetchSales })
```

### Mistake 2: Using Context for cart or auth
```typescript
// BAD — every component re-renders on every cart change
const { cart, addItem } = useCartContext();

// GOOD — only components that select cart re-render
const cartItems = useSelector((s: RootState) => s.cart.items);
```

### Mistake 3: Calling sales API directly instead of outbox
```typescript
// BAD — breaks offline, breaks idempotency
const { mutate } = useMutation({ mutationFn: (sale) => apiPost('/sales', sale) });

// GOOD — always write to outbox, OutboxWorker handles the rest
dispatch(completeSale(sale)); // writes to WatermelonDB outbox
```

### Mistake 4: Duplicating WatermelonDB data in RTK
```typescript
// BAD — two sources of truth
dispatch(setProducts(products)); // products also in SQLite

// GOOD — read from WatermelonDB directly (reactive)
const products = useQuery(database.collections.get('products').query());
```

### Mistake 5: Using TanStack Query for mutations that must be offline-safe
```typescript
// BAD — fails silently when offline, no retry queue
const { mutate } = useMutation({ mutationFn: createSale });

// GOOD — outbox survives offline, retries with backoff
dispatch(completeSale(sale));
```

---

## 8. Quick Reference Card

```
Is it data from the server?
  YES → TanStack Query (useQuery / useInfiniteQuery)

Is it a MUTATION that must work offline?
  YES → RTK thunk → WatermelonDB outbox → OutboxWorker → server

Is it local SQLite data?
  YES → WatermelonDB + withObservables

Is it global UI state (auth, cart, connectivity)?
  YES → RTK slice

Is it a stable instance / config injected once?
  YES → React Context / Provider

Is it form state?
  YES → react-hook-form
```
