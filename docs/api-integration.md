# API Integration Guide

> Two patterns are available depending on the use case.
> Pick the right one before writing any code.

---

## Which Pattern to Use?

| Situation | Use |
|---|---|
| Global auth state, selected store, user profile | **Part A — Redux Thunk** (`api-manager` + `state-manager`) |
| Page/component data — lists, detail views, CRUD | **Part B — TanStack Query** (`api-handler`) |
| Mobile + Web shared thunks | **Part A** (mobile uses Redux too) |
| Web-only server-state with caching + refetch | **Part B** |

---

# Part A — Redux Thunk Pattern

> `libs-common/api-manager` + `libs-common/state-manager`
> Use for state that must be shared globally across the app (auth, store context, user profile).

## Architecture

```
Backend endpoint
    │
    ▼
libs-common/api-manager/src/lib/{module}/
    ├── request-dto.ts     ← TypeScript interfaces (request + response shapes)
    ├── api-data.ts        ← APIData instances (URL + method declarations)
    ├── api-thunk.ts       ← generateAsyncThunk wrappers
    └── index.ts           ← re-exports
    │
    │   dispatched via useBaseStoreDispatch()
    ▼
libs-common/state-manager/src/lib/shared-slice/{module}/
    ├── model.ts           ← Slice state interface (APIState fields)
    └── slice.ts           ← createSlice with extraReducers (pending/fulfilled/rejected)
```

---

## Interactive Setup

### Q1: Module Name
```
What is the module name?
Examples: "roles", "inventory", "customer", "invoice"

Creates:
  libs-common/api-manager/src/lib/{module}/
  libs-common/state-manager/src/lib/shared-slice/{module}/
```

### Q2: Path Parameters
```
Which path params does this module use?

Already registered in PossibleTypeId (api-handler.ts):
  shopId, productId, saleId, customerId, invoiceId,
  categoryId, userId, outboxEventId, guuid, id

Need a new param name (e.g. "storeId", "roleId")?
→ Add it to PossibleTypeId in api-handler.ts FIRST.
```

### Q3: Public vs Authenticated
```
Does any endpoint skip the auth token? (e.g. OTP send, login)

  Public:         new APIData("path", APIMethod.POST, { public: true })
  Authenticated:  new APIData("path", APIMethod.GET)
```

---

## Step A-1: Register New Path Params (if needed)

**File:** [libs-common/api-manager/src/lib/api-handler.ts](../libs-common/api-manager/src/lib/api-handler.ts)

```typescript
// Add new param name to the union type
type PossibleTypeId =
  | "shopId"
  | "productId"
  | "storeId"      // ← new
  | "roleId"       // ← new
  // ...existing entries...
  | "id";
```

> The path string in `APIData` must use the exact param name as a path segment:
> `"store/storeId/roles/roleId"` — those segments are replaced at call time with values from `pathParam`.

---

## Step A-2: Define Types

**File:** `libs-common/api-manager/src/lib/{module}/request-dto.ts`

```typescript
import type { ApiResponse } from "@nks/shared-types";

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface Create{Entity}Request {
  name:         string;
  description?: string;
}

export interface Update{Entity}Request {
  name?:        string;
  description?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface {Entity}Item {
  id:          number;
  name:        string;
  description: string | null;
  createdAt:   string;
  updatedAt:   string;
}

export type {Entity}ListResponse   = ApiResponse<{Entity}Item[]>;
export type {Entity}Response       = ApiResponse<{Entity}Item>;
```

---

## Step A-3: Define Endpoints

**File:** `libs-common/api-manager/src/lib/{module}/api-data.ts`

```typescript
import { APIData, APIMethod } from "../api-handler";

export const GET_{ENTITY}_LIST: APIData = new APIData("{entities}",          APIMethod.GET);
export const GET_{ENTITY}:      APIData = new APIData("{entities}/id",       APIMethod.GET);
export const CREATE_{ENTITY}:   APIData = new APIData("{entities}",          APIMethod.POST);
export const UPDATE_{ENTITY}:   APIData = new APIData("{entities}/id",       APIMethod.PUT);
export const DELETE_{ENTITY}:   APIData = new APIData("{entities}/id",       APIMethod.DELETE);
```

---

## Step A-4: Create Thunks

**File:** `libs-common/api-manager/src/lib/{module}/api-thunk.ts`

```typescript
import {
  GET_{ENTITY}_LIST,
  GET_{ENTITY},
  CREATE_{ENTITY},
  UPDATE_{ENTITY},
  DELETE_{ENTITY},
} from "./api-data";
import type { Create{Entity}Request, Update{Entity}Request } from "./request-dto";

export const get{Entities}  = GET_{ENTITY}_LIST.generateAsyncThunk("{module}/get{Entities}");
export const get{Entity}    = GET_{ENTITY}.generateAsyncThunk("{module}/get{Entity}");
export const create{Entity} = CREATE_{ENTITY}.generateAsyncThunk<Create{Entity}Request>("{module}/create{Entity}");
export const update{Entity} = UPDATE_{ENTITY}.generateAsyncThunk<Update{Entity}Request>("{module}/update{Entity}");
export const delete{Entity} = DELETE_{ENTITY}.generateAsyncThunk("{module}/delete{Entity}");
```

---

## Step A-5: Module Index

**File:** `libs-common/api-manager/src/lib/{module}/index.ts`

```typescript
export * from "./request-dto";
export * from "./api-data";
export * from "./api-thunk";
```

---

## Step A-6: Export from api-manager

**File:** [libs-common/api-manager/src/index.ts](../libs-common/api-manager/src/index.ts)

```typescript
export * from './lib/{module}';   // ← add
```

---

## Step A-7: Create Redux Slice

### `model.ts`
**File:** `libs-common/state-manager/src/lib/shared-slice/{module}/model.ts`

```typescript
import type { APIState } from "@nks/shared-types";

export interface {Entity}SliceState {
  listState:   APIState;
  detailState: APIState;
  createState: APIState;
  updateState: APIState;
  deleteState: APIState;
}
```

### `slice.ts`
**File:** `libs-common/state-manager/src/lib/shared-slice/{module}/slice.ts`

```typescript
import { createSlice } from "@reduxjs/toolkit";
import { get{Entities}, get{Entity}, create{Entity}, update{Entity}, delete{Entity} } from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import type { {Entity}SliceState } from "./model";

const initialState: {Entity}SliceState = {
  listState:   { ...defaultAPIState },
  detailState: { ...defaultAPIState },
  createState: { ...defaultAPIState },
  updateState: { ...defaultAPIState },
  deleteState: { ...defaultAPIState },
};

export const {entity}Slice = createSlice({
  name: "{module}",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    /* List */
    builder.addCase(get{Entities}.pending,   (state)         => { state.listState.isLoading = true;  state.listState.hasError = false; state.listState.errors = undefined; });
    builder.addCase(get{Entities}.fulfilled, (state, action) => { state.listState.isLoading = false; state.listState.response = action.payload?.data; });
    builder.addCase(get{Entities}.rejected,  (state, action) => { state.listState.isLoading = false; state.listState.hasError = true;  state.listState.errors  = action.payload; });

    /* Detail */
    builder.addCase(get{Entity}.pending,   (state)         => { state.detailState.isLoading = true;  state.detailState.hasError = false; state.detailState.errors = undefined; });
    builder.addCase(get{Entity}.fulfilled, (state, action) => { state.detailState.isLoading = false; state.detailState.response = action.payload?.data; });
    builder.addCase(get{Entity}.rejected,  (state, action) => { state.detailState.isLoading = false; state.detailState.hasError = true;  state.detailState.errors  = action.payload; });

    /* Create */
    builder.addCase(create{Entity}.pending,   (state)         => { state.createState.isLoading = true;  state.createState.hasError = false; state.createState.errors = undefined; });
    builder.addCase(create{Entity}.fulfilled, (state, action) => { state.createState.isLoading = false; state.createState.response = action.payload?.data; });
    builder.addCase(create{Entity}.rejected,  (state, action) => { state.createState.isLoading = false; state.createState.hasError = true;  state.createState.errors  = action.payload; });

    /* Update */
    builder.addCase(update{Entity}.pending,   (state)         => { state.updateState.isLoading = true;  state.updateState.hasError = false; state.updateState.errors = undefined; });
    builder.addCase(update{Entity}.fulfilled, (state, action) => { state.updateState.isLoading = false; state.updateState.response = action.payload?.data; });
    builder.addCase(update{Entity}.rejected,  (state, action) => { state.updateState.isLoading = false; state.updateState.hasError = true;  state.updateState.errors  = action.payload; });

    /* Delete */
    builder.addCase(delete{Entity}.pending,   (state)         => { state.deleteState.isLoading = true;  state.deleteState.hasError = false; state.deleteState.errors = undefined; });
    builder.addCase(delete{Entity}.fulfilled, (state, action) => { state.deleteState.isLoading = false; state.deleteState.response = action.payload?.data; });
    builder.addCase(delete{Entity}.rejected,  (state, action) => { state.deleteState.isLoading = false; state.deleteState.hasError = true;  state.deleteState.errors  = action.payload; });
  },
});
```

---

## Step A-8: Register in Base Store

**File:** [libs-common/state-manager/src/lib/base-reducer.ts](../libs-common/state-manager/src/lib/base-reducer.ts)

```typescript
import { {entity}Slice } from "./shared-slice/{module}/slice";  // ← add

export const baseReducer = {
  auth:     authSlice.reducer,
  store:    storeSlice.reducer,
  {module}: {entity}Slice.reducer,   // ← add
};
```

**File:** [libs-common/state-manager/src/index.ts](../libs-common/state-manager/src/index.ts)

```typescript
export * from './lib/shared-slice/{module}/slice';   // ← add
export * from './lib/shared-slice/{module}/model';   // ← add
```

---

## Step A-9: Use in a Component

```typescript
"use client";

import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { get{Entities}, create{Entity} } from "@nks/api-manager";
import type { {Entity}Item } from "@nks/api-manager";
import { useEffect } from "react";

export function {Entity}Page() {
  const dispatch = useBaseStoreDispatch();
  const { isLoading, hasError, response } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.{module}.listState,
  );

  const items = (response as {Entity}Item[] | undefined) ?? [];

  useEffect(() => {
    dispatch(get{Entities}({}));
  }, [dispatch]);

  const handleCreate = async (name: string) => {
    const result = await dispatch(create{Entity}({ bodyParam: { name } })).unwrap();
    console.log(result.data); // ApiResponse<{Entity}Item>.data
  };

  const loadDetail = (id: string) => {
    dispatch(get{Entity}({ pathParam: { id } }));
  };

  const searchItems = (term: string) => {
    dispatch(get{Entities}({ queryParam: `?search=${term}&page=1&limit=20` }));
  };

  if (isLoading) return <div>Loading...</div>;
  if (hasError)  return <div>Error loading data.</div>;

  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}
```

---

## Part A — Request Params Reference

`RequestParams<T>` fields:

| Field | Type | When to use |
|---|---|---|
| `bodyParam` | `T` | POST / PUT / PATCH body |
| `pathParam` | `Partial<Record<PossibleTypeId, string>>` | Dynamic path segments |
| `queryParam` | `string` | Pre-built query string e.g. `"?page=1&search=foo"` |

---

## Part A — Special Cases

### Multipart / file upload

```typescript
// api-data.ts
export const UPLOAD_{ENTITY} = new APIData("shops/shopId/products/import", APIMethod.POST);

// api-thunk.ts
export const upload{Entity} = UPLOAD_{ENTITY}.generateAsyncThunkForMultipart("products/upload");

// component
dispatch(upload{Entity}({ file: selectedFile, pathParam: { shopId: "10" } }));
```

### Dynamic path not in PossibleTypeId

```typescript
// api-data.ts — factory function instead of singleton
export const UPDATE_STAFF_PERMISSIONS = (userId: number | string) =>
  new APIData(`store/staff/${userId}/permissions`, APIMethod.PATCH);

// api-thunk.ts
export const updateStaffPermissions = (userId: number | string) =>
  UPDATE_STAFF_PERMISSIONS(userId).generateAsyncThunk<UpdateStaffPermissionsRequest>(
    "store/updateStaffPermissions",
  );
```

---

---

# Part B — TanStack Query Pattern

> `libs-common/api-handler`
> Use for page/component-level server state — lists, detail views, CRUD forms.
> Gives automatic caching, background refetch, loading/error states per query.

## One-time Setup

### Install TanStack Query

```bash
# In the app that uses it (nks-web)
cd apps/nks-web
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

### Add QueryClientProvider

**File:** [apps/nks-web/src/app/providers.tsx](../apps/nks-web/src/app/providers.tsx)

```typescript
"use client";

import { ReactNode, useState } from "react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { baseStore, useBaseStoreSelector, useBaseStoreDispatch, type BaseStoreRootState } from "@nks/state-manager";
import { AuthProvider } from "@libs-web/web-utils/auth-provider";

function AuthWrapper({ children }: { children: ReactNode }) {
  const dispatch = useBaseStoreDispatch();
  const authState = useBaseStoreSelector((state: BaseStoreRootState) => state.auth);
  return <AuthProvider dispatch={dispatch} authState={authState}>{children}</AuthProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,       // 1 minute
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  return (
    <Provider store={baseStore}>
      <QueryClientProvider client={queryClient}>
        <AuthWrapper>
          {children}
        </AuthWrapper>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </Provider>
  );
}
```

---

## Module Directory

```
libs-common/api-handler/src/lib/{module}/
├── types.ts              ← Request/Response DTOs
├── api-data.ts           ← URL constants + URL builder function
├── tanstack-queries.ts   ← useQuery / useMutation hooks
└── index.ts              ← re-exports
```

---

## Interactive Setup

### Q1: Module Name
```
What is the module name?
Examples: "customer", "product", "supplier", "invoice", "employee"

Creates: libs-common/api-handler/src/lib/{module}/
```

### Q2: Endpoints
```
Which endpoints does this module need?

1. List   — GET    /{entities}
2. Detail — GET    /{entities}/{id}
3. Create — POST   /{entities}
4. Update — PUT    /{entities}/{id}
5. Delete — DELETE /{entities}/{id}

Enter comma-separated numbers (e.g. "1,2,3,4,5" for full CRUD)
```

### Q3: Query Parameters (for List endpoint)
```
What query params does the list endpoint accept?

Common options:
  page, pageSize, search, sortBy, sortOrder, status, storeId

List the ones needed:
```

### Q4: Request / Response Shape
```
Provide the response shape for:

List response data (inside ApiResponse.data):
  [{ id: 1, name: "...", createdAt: "..." }, ...]

Detail response data:
  { id: 1, name: "...", description: "...", ... }

Create/Update request body:
  { name: string; description?: string; }
```

---

## Step B-1: Define Types

**File:** `libs-common/api-handler/src/lib/{module}/types.ts`

```typescript
import type { ApiResponse } from "@nks/shared-types";

// ============================================
// List Query Parameters
// ============================================
export interface {Entity}ListParams {
  page?:      number;
  pageSize?:  number;
  search?:    string;
  sortBy?:    string;
  sortOrder?: "asc" | "desc";
  status?:    string;
  storeId?:   number;
  // Add custom filters
}

// ============================================
// List Response DTO
// ============================================
export interface {Entity}ListItem {
  id:        number;
  name:      string;
  createdAt: string;
  updatedAt: string;
  // Add fields shown in list view
}

export interface {Entity}ListResponse {
  items: {Entity}ListItem[];
  total:    number;
  page:     number;
  pageSize: number;
}

// ============================================
// Detail Response DTO
// ============================================
export interface {Entity}Detail {
  id:          number;
  name:        string;
  description: string | null;
  createdAt:   string;
  updatedAt:   string;
  // Add all detail fields
}

export type {Entity}DetailResponse = ApiResponse<{Entity}Detail>;

// ============================================
// Create / Update Request DTOs
// ============================================
export interface Create{Entity}Request {
  name:         string;
  description?: string;
  // ... required and optional fields
}

export interface Update{Entity}Request extends Partial<Create{Entity}Request> {
  // All fields optional for partial update
}

// ============================================
// Mutation Response Types
// ============================================
export type Create{Entity}Response = ApiResponse<{Entity}Detail>;
export type Update{Entity}Response = ApiResponse<{Entity}Detail>;
export type Delete{Entity}Response = ApiResponse<void>;
```

---

## Step B-2: Define Endpoints

**File:** `libs-common/api-handler/src/lib/{module}/api-data.ts`

```typescript
// ============================================
// URL Constants
// ============================================
export const {ENTITY}_ENDPOINTS = {
  LIST:   "{entities}",
  DETAIL: "{entities}/{entityId}",
  CREATE: "{entities}",
  UPDATE: "{entities}/{entityId}",
  DELETE: "{entities}/{entityId}",
} as const;

// ============================================
// URL Builder
// ============================================
export function build{Entity}Url(
  endpoint: string,
  params?: { entityId?: string | number; storeId?: string | number }
): string {
  let url = endpoint;
  if (params?.entityId !== undefined) {
    url = url.replace("{entityId}", String(params.entityId));
  }
  return url;
}
```

> For store-scoped routes, prefix the path: `"store/{storeId}/{entities}"` and include `storeId` in the builder params.

---

## Step B-3: Create Query Hooks

**File:** `libs-common/api-handler/src/lib/{module}/tanstack-queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "@nks/api-manager";
import { {ENTITY}_ENDPOINTS, build{Entity}Url } from "./api-data";
import type {
  {Entity}ListParams,
  {Entity}ListResponse,
  {Entity}DetailResponse,
  Create{Entity}Request,
  Create{Entity}Response,
  Update{Entity}Request,
  Update{Entity}Response,
  Delete{Entity}Response,
} from "./types";

// ============================================
// Query Keys Factory
// ============================================
export const {entity}Keys = {
  all: ["{entities}"] as const,

  lists: () =>
    [...{entity}Keys.all, "list"] as const,
  list: (params?: {Entity}ListParams) =>
    [...{entity}Keys.lists(), params] as const,

  details: () =>
    [...{entity}Keys.all, "detail"] as const,
  detail: (entityId: string | number) =>
    [...{entity}Keys.details(), entityId] as const,
};

// ============================================
// List Query
// ============================================
export function use{Entities}(
  params?: {Entity}ListParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: {entity}Keys.list(params),
    queryFn: async () => {
      const url = build{Entity}Url({ENTITY}_ENDPOINTS.LIST);

      const queryParams = new URLSearchParams();
      if (params?.page)      queryParams.set("page",      String(params.page));
      if (params?.pageSize)  queryParams.set("pageSize",  String(params.pageSize));
      if (params?.search)    queryParams.set("search",    params.search);
      if (params?.sortBy)    queryParams.set("sortBy",    params.sortBy);
      if (params?.sortOrder) queryParams.set("sortOrder", params.sortOrder);
      if (params?.status)    queryParams.set("status",    params.status);
      if (params?.storeId)   queryParams.set("storeId",   String(params.storeId));

      const qs = queryParams.toString();
      const response = await API.get<{Entity}ListResponse>(qs ? `${url}?${qs}` : url);
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

// ============================================
// Detail Query
// ============================================
export function use{Entity}(
  entityId: string | number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: {entity}Keys.detail(entityId),
    queryFn: async () => {
      const url = build{Entity}Url({ENTITY}_ENDPOINTS.DETAIL, { entityId });
      const response = await API.get<{Entity}DetailResponse>(url);
      return response.data;
    },
    enabled: options?.enabled ?? !!entityId,
  });
}

// ============================================
// Create Mutation
// ============================================
export function useCreate{Entity}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Create{Entity}Request) => {
      const url = build{Entity}Url({ENTITY}_ENDPOINTS.CREATE);
      const response = await API.post<Create{Entity}Response>(url, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {entity}Keys.lists() });
    },
    onError: (error) => {
      console.error("Create {entity} failed:", error);
    },
  });
}

// ============================================
// Update Mutation
// ============================================
export function useUpdate{Entity}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      data,
    }: {
      entityId: string | number;
      data: Update{Entity}Request;
    }) => {
      const url = build{Entity}Url({ENTITY}_ENDPOINTS.UPDATE, { entityId });
      const response = await API.put<Update{Entity}Response>(url, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: {entity}Keys.detail(variables.entityId) });
      queryClient.invalidateQueries({ queryKey: {entity}Keys.lists() });
    },
    onError: (error) => {
      console.error("Update {entity} failed:", error);
    },
  });
}

// ============================================
// Delete Mutation
// ============================================
export function useDelete{Entity}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityId: string | number) => {
      const url = build{Entity}Url({ENTITY}_ENDPOINTS.DELETE, { entityId });
      const response = await API.delete<Delete{Entity}Response>(url);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {entity}Keys.lists() });
    },
    onError: (error) => {
      console.error("Delete {entity} failed:", error);
    },
  });
}
```

---

## Step B-4: Module Index

**File:** `libs-common/api-handler/src/lib/{module}/index.ts`

```typescript
// Types
export type {
  {Entity}ListParams,
  {Entity}ListItem,
  {Entity}ListResponse,
  {Entity}Detail,
  {Entity}DetailResponse,
  Create{Entity}Request,
  Update{Entity}Request,
} from "./types";

// Endpoints
export { {ENTITY}_ENDPOINTS, build{Entity}Url } from "./api-data";

// Query hooks
export {
  {entity}Keys,
  use{Entities},
  use{Entity},
  useCreate{Entity},
  useUpdate{Entity},
  useDelete{Entity},
} from "./tanstack-queries";
```

---

## Step B-5: Export from api-handler

**File:** `libs-common/api-handler/src/index.ts`

```typescript
// ... existing exports
export * from "./src/lib/{module}";
```

---

## Part B — Usage Examples

### List Component

```typescript
"use client";

import { use{Entities} } from "@nks/api-handler";
import { useState } from "react";

export function {Entity}List() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = use{Entities}({
    search,
    page,
    pageSize: 20,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <div>Loading...</div>;
  if (error)     return <div>Error: {error.message}</div>;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search..."
      />
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <div>
        Total: {total}
        <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>Prev</button>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
```

### Detail Component

```typescript
"use client";

import { use{Entity} } from "@nks/api-handler";

export function {Entity}Detail({ entityId }: { entityId: number }) {
  const { data, isLoading, error } = use{Entity}(entityId);

  const entity = data?.data;

  if (isLoading) return <div>Loading...</div>;
  if (error)     return <div>Error: {error.message}</div>;
  if (!entity)   return <div>Not found</div>;

  return (
    <div>
      <h1>{entity.name}</h1>
      <p>{entity.description}</p>
    </div>
  );
}
```

### Create Form

```typescript
"use client";

import { useCreate{Entity} } from "@nks/api-handler";
import { useState } from "react";

export function Create{Entity}Form() {
  const createMutation = useCreate{Entity}();
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ name });
      setName(""); // list auto-refetches via cache invalidation
    } catch {
      // error already logged in onError
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

### Update Form

```typescript
"use client";

import { useUpdate{Entity} } from "@nks/api-handler";

export function Edit{Entity}Form({ entityId, currentName }: { entityId: number; currentName: string }) {
  const updateMutation = useUpdate{Entity}();

  const handleSave = (name: string) => {
    updateMutation.mutate({ entityId, data: { name } });
  };

  return (
    <button
      onClick={() => handleSave("New Name")}
      disabled={updateMutation.isPending}
    >
      Save
    </button>
  );
}
```

### Conditional / dependent query

```typescript
// Only fetch detail when ID is known
const { data } = use{Entity}(entityId, { enabled: !!entityId });
```

---

## Part B — Best Practices

### Query Keys
1. **Hierarchical keys** — `["{entities}", "list", params]` enables targeted invalidation
2. **Include all params in key** — if a param changes the result, it must be in the key
3. **Use the keys factory** — never construct keys manually in components

### Cache Invalidation
1. **Invalidate on all mutations** — create / update / delete all invalidate `lists()`
2. **Invalidate detail on update** — update also invalidates the specific `detail(id)` key
3. **Avoid `invalidateQueries({ queryKey: {entity}Keys.all })`** — too broad, use `.lists()` or `.detail(id)`

### Loading & Error States
1. **Always handle `isLoading`** — never render data without checking
2. **`isPending` for mutations** — disables submit buttons during in-flight requests
3. **`error.message`** — the axios interceptor normalises errors; always safe to display

### `enabled` option
1. Use `enabled: !!entityId` when the query depends on a value that may be undefined
2. Use `enabled: false` to fetch programmatically via `refetch()`

---

## Part B — Verification Checklist

- [ ] `@tanstack/react-query` installed in the consuming app
- [ ] `QueryClientProvider` added to `providers.tsx`
- [ ] `types.ts` — list params, list item, detail, create/update request interfaces defined
- [ ] `api-data.ts` — URL constants and builder function created
- [ ] `tanstack-queries.ts` — `useQuery` + `useMutation` hooks for all required operations
- [ ] `index.ts` — all types, endpoints, and hooks exported
- [ ] `api-handler/src/index.ts` — module exported
- [ ] All queries have correct `enabled` guards
- [ ] All mutations invalidate relevant query keys on success
- [ ] TypeScript compiles without errors
