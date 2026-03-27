# State Management Rules
## NKS Project — Developer Reference

> Read this before writing any state-related code. No exceptions.

---

## Rule 1 — Know the Four Layers

Every piece of state belongs to exactly one layer. Never mix them.

| Layer | Tool | Package |
|---|---|---|
| Global client state | Redux Toolkit | `@nks/state-manager` |
| Server state (reads) | TanStack Query | `@tanstack/react-query` |
| Local SQLite state | WatermelonDB | `@nks/mobile-utils` |
| Stable instances / DI | React Context | built-in |

---

## Rule 2 — What Goes in RTK (non-negotiable)

Only these state types go in Redux slices:

- Auth — `isAuthenticated`, `accessToken`, `user`
- Cart — `items`, `totals`, `discountPercent`, `paymentMethod`
- Connectivity — `ONLINE | DEGRADED | OFFLINE | SYNCING`
- Sync status — `pendingCount`, `deadCount`, `lastSyncAt`, `isSyncing`
- Shop config — `shopId`, `gstin`, `invoicePrefix`, `defaultTaxRate`
- API loading/error states — `isLoading`, `hasError`, `errors` via `extraReducers`

**If the data is not in this list, it does not go in RTK.**

---

## Rule 3 — What Goes in TanStack Query (non-negotiable)

Only server-fetched read data goes in TanStack Query:

- Sales history list (paginated)
- Dashboard and reports
- User profile (fresh from server)
- Inventory stock levels (admin view)
- Customer search results
- Any list that needs background refetch or infinite scroll

**Never use `useMutation` for anything that must work offline.**

---

## Rule 4 — What Goes in WatermelonDB (non-negotiable)

Only local-first persisted data goes in WatermelonDB:

- Product catalog
- Outbox events queue
- Local sale records (before sync)
- Customer local cache

**Never duplicate WatermelonDB data into RTK. Pick one source of truth.**

---

## Rule 5 — What Goes in React Context (non-negotiable)

Only stable singleton instances go in Context:

- `DatabaseProvider` → WatermelonDB `database` instance
- `QueryClientProvider` → TanStack Query client
- `MobileThemeProvider` → theme tokens
- `I18nProvider` → translation function

**Never put cart, auth, or connectivity in Context. It will cause re-renders.**

---

## Rule 6 — The Outbox Rule (most critical)

> **Sales and payment mutations ALWAYS write to WatermelonDB outbox. Never call the API directly.**

```typescript
// FORBIDDEN
apiPost('/sales', sale);
useMutation({ mutationFn: createSale });

// REQUIRED
dispatch(completeSale(sale)); // writes to outbox, OutboxWorker syncs later
```

This applies to: `SALE_CREATED`, `SALE_ITEMS_ADDED`, `INVENTORY_DEDUCTED`, `PAYMENT_PROCESSED`, `INVOICE_GENERATED`

---

## Rule 7 — Slice File Structure

Every RTK slice must follow this structure exactly:

```
src/lib/[store]/[feature]/
├── model.ts    ← state interfaces only, imports from @nks/shared-types and @nks/api-manager
└── slice.ts    ← createSlice with extraReducers, imports thunks from @nks/api-manager
```

No logic in `model.ts`. No type definitions in `slice.ts`.

---

## Rule 8 — extraReducers Pattern

Every async thunk must handle all three cases. No skipping.

```typescript
builder.addCase(thunkName.pending, (state) => {
  state.xState.isLoading = true;
});
builder.addCase(thunkName.fulfilled, (state, action) => {
  state.xState.isLoading = false;
  state.xState.response = action?.payload?.data;
});
builder.addCase(thunkName.rejected, (state, action) => {
  state.xState.isLoading = false;
  if (action.payload) {
    state.xState.errors = action?.payload;
  }
});
```

---

## Rule 9 — API Manager File Structure

Every api-manager module must have exactly four files:

```
src/lib/[module]/
├── api-data.ts       ← APIData instances with APIMethod enum
├── api-thunk.ts      ← generateAsyncThunk calls only, no logic
├── request-dto.ts    ← TypeScript interfaces for request and response
└── index.ts          ← export * from api-thunk + request-dto
```

Endpoints that do not require auth (login, register, refresh) must use `{ public: true }`.

---

## Rule 10 — public: true for Auth Endpoints

```typescript
// REQUIRED for login, register, token refresh
new APIData('v1/auth/login', APIMethod.POST, { public: true });

// WRONG — sends stale/empty Authorization header
new APIData('v1/auth/login', APIMethod.POST);
```

---

## Rule 11 — Provider Stack Order

`_layout.tsx` must wrap providers in this exact order:

```typescript
<Provider store={nksStore}>            // 1. RTK — outermost
  <QueryClientProvider client={...}>   // 2. TanStack Query
    <DatabaseProvider>                 // 3. WatermelonDB
      <ConnectivityProbe />            // 4. Background workers (renderless)
      <OutboxWorker />
      <SafeAreaProvider>               // 5. UI infrastructure
        <I18nProvider>
          <MobileThemeProvider>
            <Stack />
          </MobileThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </DatabaseProvider>
  </QueryClientProvider>
</Provider>
```

---

## Rule 12 — Form State

All form state uses `react-hook-form`. No form fields in RTK. No form fields in useState for complex forms.

```typescript
const { control, handleSubmit, formState: { errors } } = useForm<CreateProductRequest>();
```

---

## Rule 13 — Selectors

Always type selectors with `RootState`. Never access store directly outside components.

```typescript
// REQUIRED
const cart = useSelector((s: RootState) => s.cart);

// FORBIDDEN
nksStore.getState().cart; // outside a component or hook
```

---

## Rule 14 — No Direct State Mutation

Never mutate state outside a reducer. RTK uses Immer — only mutate inside `reducers` or `extraReducers`.

```typescript
// FORBIDDEN — outside a slice
store.cart.items.push(item);

// REQUIRED — inside a reducer
addItem(state, action) {
  state.items.push(action.payload);
}
```

---

## Rule 15 — Connectivity is Read-Only from Components

Components read connectivity state. Only `ConnectivityProbe` writes it.

```typescript
// ALLOWED in any component
const { status } = useSelector((s: RootState) => s.connectivity);

// FORBIDDEN in a component or screen
dispatch(setConnectivity({ status: 'OFFLINE', ... }));
// Only ConnectivityProbe calls setConnectivity
```

---

## Quick Checklist Before Submitting a Feature

- [ ] Is server list data in TanStack Query (not RTK)?
- [ ] Is cart/auth/connectivity in RTK (not Context)?
- [ ] Does every sale mutation go through the outbox (not a direct API call)?
- [ ] Is WatermelonDB data NOT duplicated in RTK?
- [ ] Does every slice have `model.ts` + `slice.ts`?
- [ ] Does every async thunk have `pending` + `fulfilled` + `rejected`?
- [ ] Are auth endpoints marked `{ public: true }`?
- [ ] Is form state in `react-hook-form`?
