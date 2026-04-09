# Lookups Module — Integration Guide

**Location**: `/Users/saran/ayphen/projects/nks/libs-common/api-manager/src/lib/lookups`

## Module Structure

```
lookups/
├── api-data.ts                    ← 32 APIData endpoints
├── request-dto.ts                 ← Request/Response types
├── tanstack-queries.ts            ← All hooks (19 query + 15 mutation)
├── lookup-hooks.ts                ← Legacy (deprecated, use tanstack-queries.ts)
└── LOOKUPS_INTEGRATION_GUIDE.md   ← This file
```

---

## APIData Endpoints (32 Total)

### Query Endpoints (10)

```typescript
import {
  GET_LOOKUP_TYPES,         // Admin: List all lookup types + value counts
  GET_LOOKUP_VALUES,        // Admin: List values for a lookup type
  GET_SALUTATIONS,          // Public: Mr., Mrs., Dr., Shri, Smt.
  GET_COUNTRIES,            // Public: List of countries
  GET_ADDRESS_TYPES,        // Public: Billing, Shipping, Residential
  GET_COMMUNICATION_TYPES,  // Public: Email, Phone, SMS
  GET_DESIGNATIONS,         // Public: Manager, Cashier, Delivery
  GET_STORE_LEGAL_TYPES,    // Public: Pvt Ltd, Proprietorship
  GET_STORE_CATEGORIES,     // Public: Retail, Pharmacy, Grocery
  GET_CURRENCIES,           // Public: INR, USD, EUR
  GET_VOLUMES,              // Public: Liters, Kg, Units
  GET_SUBSCRIPTION_PLAN_TYPES,           // Public: Monthly, Annual
  GET_SUBSCRIPTION_BILLING_FREQUENCIES,  // Public: Monthly, Yearly
  GET_SUBSCRIPTION_CURRENCIES,           // Public: Payment currencies
  GET_SUBSCRIPTION_STATUSES,             // Public: Active, Inactive
} from "@nks/api-manager";
```

### Mutation Endpoints (21)

**Salutations**: CREATE, UPDATE, DELETE (3)
**Countries**: CREATE, UPDATE, DELETE (3)
**Designations**: CREATE, UPDATE, DELETE (3)
**Store Legal Types**: CREATE, UPDATE, DELETE (3)
**Store Categories**: CREATE, UPDATE, DELETE (3)
**Admin Lookups**: CREATE_TYPE, UPDATE_TYPE, DELETE_TYPE, CREATE_VALUE, UPDATE_VALUE, DELETE_VALUE (6)

---

## Response Types

### Response Structure

All list responses follow the same wrapped format:

```typescript
{
  status: "success",
  message: "Salutations retrieved successfully",
  data: {
    data: [
      {
        id: 1,
        code: "MR",
        title: "Mr.",
        isActive: true,
        isHidden: false,
        isSystem: true,
        createdAt: "2026-04-06T12:03:15.560Z",
        updatedAt: "2026-04-06T12:03:15.560Z"
      },
      // ... more items
    ],
    message: "Salutations retrieved successfully"
  }
}
```

### Type Definitions

```typescript
// Salutations
export interface SalutationsListResponse {
  data: {
    data: SalutationResponse[];
    message: string;
  };
  message: string;
  status: string;
}

export interface SalutationResponse {
  id: number;
  code: string;
  title: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalutationRequest {
  salutationText: string;
  description?: string;
}

export interface UpdateSalutationRequest {
  salutationText?: string;
  description?: string;
}
```

**Pattern**: Same structure for all 10 resource types (Salutations, Countries, Designations, etc.)

---

## Query Hooks

### Basic Query Hook Pattern

```typescript
// ✅ Reference data (rarely changes)
export const useSalutations = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    queryKey: lookupKeys.salutations(),
    staleTime: 1000 * 60 * 5,  // 5 minutes
    enabled: options?.enabled ?? true,
  });
};
```

**Parameters**:
- `options.enabled` — conditionally fetch (default: `true`)

**Returns**:
```typescript
{
  data: SalutationsListResponse | undefined,
  isLoading: boolean,
  isError: boolean,
  error: Error | null,
  refetch: () => Promise,
  // ... other TanStack Query properties
}
```

### Data Extraction in Components

```typescript
const { data, isLoading } = useSalutations();

// Extract items from nested response structure
const items = data?.data?.data ?? [];

// Correct typing
const salutations: SalutationResponse[] = items;
```

### All Query Hooks (19 total)

| Hook | Returns | Cache TTL | Use Case |
|------|---------|-----------|----------|
| `useLookupTypes()` | LookupTypeItem[] | 5m | Admin: list lookup type configurations |
| `useLookupValues(code)` | LookupValueItem[] | 5m | Admin: list values for a type |
| `useSalutations()` | SalutationResponse[] | 5m | Public: Mr., Mrs., Dr., etc. |
| `useCountries()` | CountryResponse[] | 5m | Public: country list |
| `useAddressTypes()` | AddressTypeResponse[] | 5m | Public: billing/shipping types |
| `useCommunicationTypes()` | CommunicationTypeResponse[] | 5m | Public: email/phone/sms |
| `useDesignations()` | DesignationResponse[] | 5m | Public: staff roles |
| `useStoreLegalTypes()` | StoreLegalTypeResponse[] | 5m | Public: business entity types |
| `useStoreCategories()` | StoreCategoryResponse[] | 5m | Public: retail/pharmacy/etc |
| `useCurrencies()` | CurrencyResponse[] | 5m | Public: payment currencies |
| `useVolumes()` | VolumeResponse[] | 5m | Public: measurement units |
| `useSubscriptionPlanTypes()` | LookupValueItem[] | 5m | Public: subscription plans |
| `useSubscriptionBillingFrequencies()` | LookupValueItem[] | 5m | Public: billing frequencies |
| `useSubscriptionCurrencies()` | LookupValueItem[] | 5m | Public: subscription currencies |
| `useSubscriptionStatuses()` | LookupValueItem[] | 5m | Public: subscription states |

---

## Mutation Hooks

### Basic Mutation Hook Pattern

```typescript
// ✅ Mutation with cache invalidation
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
```

**Type Parameters**:
- First `<TResponse>` — what the API returns (e.g., `SalutationResponse`)
- Second `<TBody>` — what you send (e.g., `CreateSalutationRequest`)

**Returns**:
```typescript
{
  mutate: (data: CreateSalutationRequest) => void,
  mutateAsync: (data: CreateSalutationRequest) => Promise<SalutationResponse>,
  isPending: boolean,
  isError: boolean,
  error: Error | null,
  // ... other properties
}
```

### All Mutation Hooks (15 total)

**Salutations** (3):
- `useCreateSalutation()` — POST /salutations
- `useUpdateSalutation()` — PUT /salutations/:id
- `useDeleteSalutation()` — DELETE /salutations/:id

**Countries** (3):
- `useCreateCountry()` — POST /countries
- `useUpdateCountry()` — PUT /countries/:id
- `useDeleteCountry()` — DELETE /countries/:id

**Designations** (3):
- `useCreateDesignation()` — POST /designations
- `useUpdateDesignation()` — PUT /designations/:id
- `useDeleteDesignation()` — DELETE /designations/:id

**Store Legal Types** (3):
- `useCreateStoreLegalType()` — POST /store-legal-types
- `useUpdateStoreLegalType()` — PUT /store-legal-types/:id
- `useDeleteStoreLegalType()` — DELETE /store-legal-types/:id

**Store Categories** (3):
- `useCreateStoreCategory()` — POST /store-categories
- `useUpdateStoreCategory()` — PUT /store-categories/:id
- `useDeleteStoreCategory()` — DELETE /store-categories/:id

---

## Query Key Factory

### Purpose
Centralized cache key management for consistent invalidation.

```typescript
export const lookupKeys = {
  all: ["lookups"] as const,
  types: () => [...lookupKeys.all, "types"] as const,
  values: (code: string) => [...lookupKeys.all, "values", code] as const,
  salutations: () => [...lookupKeys.all, "salutations"] as const,
  countries: () => [...lookupKeys.all, "countries"] as const,
  addressTypes: () => [...lookupKeys.all, "addressTypes"] as const,
  communicationTypes: () => [...lookupKeys.all, "communicationTypes"] as const,
  designations: () => [...lookupKeys.all, "designations"] as const,
  storeLegalTypes: () => [...lookupKeys.all, "storeLegalTypes"] as const,
  storeCategories: () => [...lookupKeys.all, "storeCategories"] as const,
  currencies: () => [...lookupKeys.all, "currencies"] as const,
  volumes: () => [...lookupKeys.all, "volumes"] as const,
};
```

### Usage in Cache Invalidation

```typescript
// ✅ CORRECT — specific invalidation
const createMutation = useMutation(
  CREATE_SALUTATION.mutationOptions<SalutationResponse, CreateSalutationRequest>({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
    },
  })
);

// ❌ WRONG — too broad
queryClient.invalidateQueries({ queryKey: lookupKeys.all });  // Invalidates ALL lookups
```

---

## Component Integration Examples

### Example 1: Simple List Display

```typescript
// components/salutations-list.tsx
"use client";

import { useSalutations } from "@nks/api-manager";

export function SalutationsList() {
  const { data, isLoading, isError, error } = useSalutations();

  if (isLoading) return <div>Loading salutations...</div>;
  if (isError) return <div>Error: {error?.message}</div>;

  // ✅ Extract from nested response
  const items = data?.data?.data ?? [];

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
  );
}
```

### Example 2: CRUD Table with Modal

```typescript
// components/salutations-table.tsx
"use client";

import { useState } from "react";
import {
  useSalutations,
  useCreateSalutation,
  useUpdateSalutation,
  useDeleteSalutation,
  type CreateSalutationRequest,
  type UpdateSalutationRequest,
} from "@nks/api-manager";

interface Salutation {
  id: number;
  title: string;
  code: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SalutationsTable() {
  // Query
  const { data, isLoading } = useSalutations();
  const items = data?.data?.data ?? [];

  // Mutations
  const createMutation = useCreateSalutation();
  const updateMutation = useUpdateSalutation();
  const deleteMutation = useDeleteSalutation();

  // Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<Salutation | null>(null);

  const handleCreate = async (formData: Record<string, string>) => {
    try {
      const data: CreateSalutationRequest = {
        salutationText: formData.salutationText,
        description: formData.description,
      };
      await createMutation.mutateAsync(data);
      setIsFormOpen(false);
    } catch (error) {
      console.error("Create failed:", error);
    }
  };

  const handleUpdate = async (formData: Record<string, string>) => {
    if (!editingId) return;
    try {
      const data: UpdateSalutationRequest = {
        salutationText: formData.salutationText,
        description: formData.description,
      };
      await updateMutation.mutateAsync({ id: editingId, ...data });
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => setIsFormOpen(true)}>Add New</button>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Code</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.code}</td>
              <td>{item.isActive ? "Active" : "Inactive"}</td>
              <td>
                <button onClick={() => {
                  setEditingId(item.id);
                  setSelectedItem(item);
                  setIsFormOpen(true);
                }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isFormOpen && (
        <FormModal
          isOpen={isFormOpen}
          initialData={selectedItem ? {
            salutationText: selectedItem.title,
            description: "",
          } : undefined}
          onSubmit={editingId ? handleUpdate : handleCreate}
          onClose={() => {
            setIsFormOpen(false);
            setEditingId(null);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
```

### Example 3: Dependent Query

```typescript
// components/store-details.tsx
"use client";

import { useParams } from "next/navigation";
import {
  useStore,
  useStoreCategories,
} from "@nks/api-manager";

export function StoreDetails() {
  const { storeId } = useParams<{ storeId: string }>();

  // Fetch store first
  const { data: storeData, isLoading: storeLoading } = useStore(
    storeId ? Number(storeId) : null,
    { enabled: !!storeId }  // Only if storeId exists
  );

  // Fetch categories only after store is loaded
  const { data: categoriesData, isLoading: categoriesLoading } = useStoreCategories(
    { enabled: !!storeData?.data?.id }  // Only if store loaded
  );

  if (storeLoading) return <div>Loading store...</div>;
  if (!storeData?.data) return <div>Store not found</div>;

  const categories = categoriesData?.data?.data ?? [];

  return (
    <div>
      <h1>{storeData.data.storeName}</h1>
      <h2>Categories</h2>
      <ul>
        {categoriesLoading ? (
          <li>Loading categories...</li>
        ) : (
          categories.map((cat) => <li key={cat.id}>{cat.name}</li>)
        )}
      </ul>
    </div>
  );
}
```

### Example 4: Conditional Rendering Based on Query Status

```typescript
// components/lookup-config.tsx
"use client";

import { useSalutations } from "@nks/api-manager";

export function LookupConfig() {
  const { data, isLoading, isError, error, refetch } = useSalutations();
  const items = data?.data?.data ?? [];

  return (
    <div>
      {isLoading && <div className="spinner">Loading...</div>}

      {isError && (
        <div className="error">
          <p>Failed to load salutations: {error?.message}</p>
          <button onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="empty">No salutations found.</div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="success">
          <p>Loaded {items.length} salutations</p>
          <ul>
            {items.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Common Patterns & Best Practices

### ✅ DO

```typescript
// 1. Extract items safely
const items = data?.data?.data ?? [];

// 2. Use the correct response type
const { data }: UseQueryResult<SalutationsListResponse> = useSalutations();

// 3. Check loading state before rendering
if (isLoading) return <LoadingSpinner />;

// 4. Handle errors explicitly
if (isError) return <ErrorAlert error={error} />;

// 5. Use mutation result properly
const { mutateAsync, isPending } = useCreateSalutation();
await mutateAsync(formData);

// 6. Set enabled conditions for conditional queries
const { data } = useSalutations({ enabled: !!selectedId });

// 7. Use specific query keys for invalidation
queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
```

### ❌ DON'T

```typescript
// 1. Don't use data directly without null check
const items = data.data.data;  // ❌ Will crash if data is undefined

// 2. Don't mix Redux and TanStack for same data
const lookup = useBaseStoreSelector(...);  // ❌ Use TanStack Query instead

// 3. Don't forget cache invalidation
await createMutation.mutateAsync(data);  // ❌ Cache will be stale

// 4. Don't use try/catch with async dispatch
try {
  await dispatch(action);  // ❌ Wrong pattern
} catch (err) {}

// 5. Don't make mutations without proper error handling
mutate(data);  // ❌ Errors are silently ignored

// 6. Don't invalidate too broadly
queryClient.invalidateQueries({ queryKey: ["lookups"] });  // ❌ Invalidates everything

// 7. Don't forget enabled conditions
const { data } = useSalutations();  // ❌ If conditional, always runs
```

---

## Debugging

### Check Cache State

```typescript
// In browser console
localStorage.getItem("REACT_QUERY_OFFLINE_CACHE");
// Or use React Query DevTools
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
```

### Monitor Query State

```typescript
const { data, status, fetchStatus } = useSalutations();

console.log({
  status,      // "pending" | "error" | "success"
  fetchStatus, // "fetching" | "idle"
  data,
});
```

### Force Refresh

```typescript
const { refetch } = useSalutations();

// Manual refetch
const handleRefresh = async () => {
  const result = await refetch();
  console.log("Refreshed:", result.data);
};
```

---

## Migration from Legacy

### Old Pattern (lookup-hooks.ts — deprecated)
```typescript
// ❌ Old
import { lookupHooks } from "@nks/api-manager";
const { salutations } = lookupHooks.useSalutations();
```

### New Pattern (tanstack-queries.ts — use this)
```typescript
// ✅ New
import { useSalutations } from "@nks/api-manager";
const { data } = useSalutations();
const items = data?.data?.data ?? [];
```

---

## File Mapping

| File | Purpose | Usage |
|------|---------|-------|
| `api-data.ts` | Define all 32 endpoints | Internal only, imported by tanstack-queries.ts |
| `request-dto.ts` | Type definitions | Import types in components |
| `tanstack-queries.ts` | All 19 query + 15 mutation hooks | **Use these in components** |
| `lookup-hooks.ts` | Legacy hooks | **DEPRECATED — don't use** |

---

## Exports from @nks/api-manager

```typescript
// Hooks (19 query + 15 mutation)
export {
  useSalutations,
  useCreateSalutation,
  useUpdateSalutation,
  useDeleteSalutation,
  useCountries,
  useCreateCountry,
  useUpdateCountry,
  useDeleteCountry,
  // ... + 23 more
} from "@nks/api-manager";

// Types
export type {
  SalutationsListResponse,
  SalutationResponse,
  CreateSalutationRequest,
  UpdateSalutationRequest,
  // ... + request/response types for all resources
} from "@nks/api-manager";
```

---

## Quick Start

1. **Import hook** — `import { useSalutations } from "@nks/api-manager"`
2. **Extract items** — `const items = data?.data?.data ?? []`
3. **Type extraction** — Add type in response DTO file
4. **Display in component** — Render items with null checks
5. **Add mutation** — Import create/update/delete hooks
6. **Cache invalidation** — Add `onSuccess` callback with `invalidateQueries`

