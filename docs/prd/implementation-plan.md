# NKS Implementation Plan
## Architecture, Setup, and Data Flow

> Modeled after the Ayphen `common/` pattern — adapted for offline-first mobile POS.

---

## 1. Overview

The `common/` monorepo uses four packages that work together:

| `common/` Package | Role |
|---|---|
| `shared-types` | TypeScript interfaces for all domain models |
| `api-manager` | `APIData` class + async thunks per endpoint |
| `state-manager` | RTK slices consuming api-manager thunks |
| `utils-and-constants` | Formatting, constants, helpers |

NKS follows the **same four-layer pattern** with one critical addition: an **outbox adapter** that intercepts all mutation thunks and routes them through WatermelonDB when offline.

---

## 2. Target Monorepo Structure

```
nks/
├── apps/
│   ├── nks-backend/          # NestJS API
│   └── nks-mobile/           # Expo React Native
├── libs-mobile/
│   └── mobile-utils/         # Axios interceptors, auth storage, network probe (exists)
└── libs-common/
    ├── nks-shared-types/     # ← mirrors common/shared-types
    ├── nks-api-manager/      # ← mirrors common/api-manager
    ├── nks-state-manager/    # ← mirrors common/state-manager
    └── nks-utils/            # ← mirrors common/utils-and-constants
```

All four `libs-common/` packages are consumed by `nks-mobile` (and later `nks-web`). The backend does **not** consume them.

---

## 3. Layer 1 — `nks-shared-types`

Mirrors `common/shared-types`. Every domain model and API state interface lives here.

### 3.1 Base API State (mirrors `APIState`)

```typescript
// src/lib/default-api-types.ts

export interface NksAPIState {
  isLoading: boolean;
  hasError: boolean;
  response: any;
  errors: any;
}

export const defaultNksAPIState: NksAPIState = {
  isLoading: false,
  hasError: false,
  response: undefined,
  errors: undefined,
};

export const defaultNksAPIStateList: NksAPIState = {
  ...defaultNksAPIState,
  response: [],
};

export interface NksApiResponse<T> {
  status: 'success' | 'error' | 'warning';
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### 3.2 Domain Models

```typescript
// src/lib/product.types.ts
export interface ProductModel {
  id: string;                   // UUID (server)
  localId: string;              // WatermelonDB id
  name: string;
  skuCode: string;
  barcode?: string;
  sellingPrice: number;         // in paise (₹ × 100)
  costPrice: number;
  taxRate: number;              // GST percentage: 0, 5, 12, 18, 28
  categoryId: string;
  unit: 'PCS' | 'KG' | 'L' | 'BOX';
  stockQuantity: number;
  isActive: boolean;
  syncedAt?: string;
}

// src/lib/sale.types.ts
export interface SaleModel {
  id: string;
  localId: string;
  invoiceNumber: string;
  customerId?: string;
  items: SaleItemModel[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  deviceCreatedAt: string;      // ISO string — for receipt display only
  serverReceivedAt?: string;    // set after sync — authoritative for accounting
  syncStatus: SyncStatus;
}

export interface SaleItemModel {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'DEAD';

// src/lib/outbox-event.types.ts
export interface OutboxEventModel {
  id: string;                   // UUID generated at creation — NEVER regenerated
  eventType: OutboxEventType;
  aggregateId: string;          // saleId
  seq: number;                  // 1–5 (ordering within a sale)
  payload: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;           // max 10 before DEAD
  nextRetryAt: string;          // ISO — computed with exponential backoff
  deviceCreatedAt: string;
  lastErrorMessage?: string;
}

export type OutboxEventType =
  | 'SALE_CREATED'
  | 'SALE_ITEMS_ADDED'
  | 'INVENTORY_DEDUCTED'
  | 'PAYMENT_PROCESSED'
  | 'INVOICE_GENERATED';

// src/lib/customer.types.ts
export interface CustomerModel {
  id: string;
  localId: string;
  name: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  totalPurchases: number;
  outstandingBalance: number;   // for credit sales
}

// src/lib/payment.types.ts
export interface PaymentModel {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string;     // UPI txn ID, card last 4
  receivedAt: string;
}

// src/lib/inventory.types.ts
export interface InventoryDeltaModel {
  productId: string;
  delta: number;                // ALWAYS negative for a sale (e.g. -3) — never resulting qty
  reason: 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'OPENING';
  saleId?: string;
}

// src/lib/auth.types.ts
export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  shopId: string;
  shopName: string;
}

// src/lib/config.types.ts
export interface ShopConfig {
  shopId: string;
  shopName: string;
  address: string;
  gstin?: string;
  defaultTaxRate: number;
  currencySymbol: string;       // '₹'
  invoicePrefix: string;        // 'INV-'
  lowStockThreshold: number;
}

export interface ConnectivityState {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';
  lastCheckedAt: string;
  latencyMs?: number;
}
```

### 3.3 Barrel Export

```typescript
// src/index.ts
export * from './lib/default-api-types';
export * from './lib/product.types';
export * from './lib/sale.types';
export * from './lib/outbox-event.types';
export * from './lib/customer.types';
export * from './lib/payment.types';
export * from './lib/inventory.types';
export * from './lib/auth.types';
export * from './lib/config.types';
```

---

## 4. Layer 2 — `nks-api-manager`

Mirrors `common/api-manager`. Each feature module has three files:
- `api-data.ts` — endpoint definitions (NKS equivalent of `APIData` class)
- `api-thunk.ts` — `createAsyncThunk` wrappers
- `request-dto.ts` — input/output interfaces

### 4.1 Core API Handler

```typescript
// src/lib/api-handler.ts

import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiGet, apiPost, apiPut, apiDelete } from '@nks/mobile-utils';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface PathParams {
  shopId?: string;
  productId?: string;
  saleId?: string;
  customerId?: string;
  [key: string]: string | undefined;
}

export class NksAPIData {
  constructor(
    private readonly method: HttpMethod,
    private readonly path: string,
  ) {}

  private resolvePath(params?: PathParams): string {
    let resolved = this.path;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) resolved = resolved.replace(key, value);
      });
    }
    return resolved;
  }

  generateAsyncThunk<TRequest, TResponse>(thunkName: string) {
    return createAsyncThunk<TResponse, { params?: PathParams; body?: TRequest }>(
      thunkName,
      async ({ params, body }, { rejectWithValue }) => {
        try {
          const url = this.resolvePath(params);
          switch (this.method) {
            case 'GET':    return await apiGet<TResponse>(url);
            case 'POST':   return await apiPost<TResponse>(url, body);
            case 'PUT':    return await apiPut<TResponse>(url, body);
            case 'DELETE': return await apiDelete<TResponse>(url);
          }
        } catch (err: any) {
          return rejectWithValue(err?.response?.data ?? err.message);
        }
      },
    );
  }
}
```

### 4.2 Module: Products

```
src/lib/products/
├── api-data.ts
├── api-thunk.ts
└── request-dto.ts
```

```typescript
// api-data.ts
import { NksAPIData } from '../api-handler';

export const GET_PRODUCT_LIST   = new NksAPIData('GET',    'shops/shopId/products');
export const GET_PRODUCT_DETAIL = new NksAPIData('GET',    'shops/shopId/products/productId');
export const CREATE_PRODUCT     = new NksAPIData('POST',   'shops/shopId/products');
export const UPDATE_PRODUCT     = new NksAPIData('PUT',    'shops/shopId/products/productId');
export const DELETE_PRODUCT     = new NksAPIData('DELETE', 'shops/shopId/products/productId');
export const SEARCH_PRODUCTS    = new NksAPIData('GET',    'shops/shopId/products/search');

// api-thunk.ts
import { GET_PRODUCT_LIST, GET_PRODUCT_DETAIL, CREATE_PRODUCT, UPDATE_PRODUCT } from './api-data';
import { ProductModel } from '@nks/shared-types';
import { CreateProductRequest, UpdateProductRequest } from './request-dto';

export const getProductList   = GET_PRODUCT_LIST.generateAsyncThunk<void, ProductModel[]>('products/list');
export const getProductDetail = GET_PRODUCT_DETAIL.generateAsyncThunk<void, ProductModel>('products/detail');
export const createProduct    = CREATE_PRODUCT.generateAsyncThunk<CreateProductRequest, ProductModel>('products/create');
export const updateProduct    = UPDATE_PRODUCT.generateAsyncThunk<UpdateProductRequest, ProductModel>('products/update');

// request-dto.ts
export interface CreateProductRequest {
  name: string;
  skuCode: string;
  barcode?: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  categoryId: string;
  unit: string;
  openingStock?: number;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}
```

### 4.3 Module: Sales (Outbox-Aware)

Sales are **write-local-first** — thunks write to WatermelonDB outbox, never call API directly.

```
src/lib/sales/
├── api-data.ts         # Read endpoints only (GET list, detail)
├── api-thunk.ts        # GET thunks (server) + outbox thunks (local write)
├── outbox-writer.ts    # Writes sale to WatermelonDB outbox (NO direct API call)
└── request-dto.ts
```

```typescript
// outbox-writer.ts
import { database } from '@nks/mobile-utils';   // WatermelonDB instance
import { v4 as uuidv4 } from 'uuid';
import { SaleModel, OutboxEventType } from '@nks/shared-types';

// THE RULE: Mutations always write to outbox. Never call sales/payments API directly.
export const writeSaleToOutbox = async (sale: SaleModel): Promise<void> => {
  await database.write(async () => {
    const saleId = sale.localId;
    const now = new Date().toISOString();

    const events: Array<{ type: OutboxEventType; seq: number; payload: object }> = [
      { type: 'SALE_CREATED',       seq: 1, payload: { saleId, ...sale } },
      { type: 'SALE_ITEMS_ADDED',   seq: 2, payload: { saleId, items: sale.items } },
      { type: 'INVENTORY_DEDUCTED', seq: 3, payload: { saleId, deltas: sale.items.map(i => ({ productId: i.productId, delta: -i.quantity })) } },
      { type: 'PAYMENT_PROCESSED',  seq: 4, payload: { saleId, method: sale.paymentMethod, amount: sale.totalAmount } },
      { type: 'INVOICE_GENERATED',  seq: 5, payload: { saleId, invoiceNumber: sale.invoiceNumber } },
    ];

    const outboxCollection = database.collections.get('outbox_events');
    for (const event of events) {
      await outboxCollection.create((record: any) => {
        record.id = uuidv4();       // NEVER regenerated on retry
        record.eventType = event.type;
        record.aggregateId = saleId;
        record.seq = event.seq;
        record.payload = JSON.stringify(event.payload);
        record.status = 'PENDING';
        record.retryCount = 0;
        record.deviceCreatedAt = now;
        record.nextRetryAt = now;
      });
    }
  });
};

// api-thunk.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { SaleModel } from '@nks/shared-types';
import { writeSaleToOutbox } from './outbox-writer';

// Local write — no network
export const completeSale = createAsyncThunk<SaleModel, SaleModel>(
  'sales/complete',
  async (sale, { rejectWithValue }) => {
    try {
      await writeSaleToOutbox(sale);
      return sale;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// Server read — paginated history
export const getSaleHistory = GET_SALE_LIST.generateAsyncThunk<void, SaleModel[]>('sales/history');
```

### 4.4 All Modules Summary

| Module | api-data endpoints | Has outbox writer? |
|---|---|---|
| `products` | GET list, detail, search; POST, PUT, DELETE | No (reads only from server; writes go through admin) |
| `sales` | GET list, detail | **Yes** — `completeSale` writes to outbox |
| `payments` | GET list | **Yes** — bundled in sales outbox |
| `inventory` | GET stock levels | **Yes** — deltas bundled in sales outbox |
| `customers` | GET, POST, PUT | No — soft online (queue if offline) |
| `invoices` | GET list, detail | No — generated server-side post-sync |
| `sync` | POST `/api/v1/sync/outbox` | Special — outbox queue worker |
| `auth` | POST login, refresh | No — separate axios (no interceptors) |
| `config` | GET shop config, tax rates | No — read-only, cached 24h |

---

## 5. Layer 3 — `nks-state-manager`

Mirrors `common/state-manager`. RTK store with domain slices.

### 5.1 Store Organization

```
src/lib/
├── shared-slice/
│   ├── auth/                  # Access token, user profile, shop info
│   ├── connectivity/          # ONLINE/DEGRADED/OFFLINE/SYNCING
│   ├── sync-status/           # Outbox queue depth, last sync time
│   └── shop-config/           # GST rates, invoice prefix, settings
├── pos-store/
│   ├── cart/                  # Active sale items, totals
│   ├── product-catalog/       # WatermelonDB-backed product list for POS
│   └── customer-lookup/       # Quick customer search for billing
└── admin-store/
    ├── product-management/    # CRUD state for product admin screen
    ├── sales-history/         # Paginated sales list
    ├── inventory/             # Stock levels, adjustment state
    └── customer-management/   # Customer CRUD
```

### 5.2 Slice Pattern (identical to `common/`)

Each slice follows the exact pattern from `common/state-manager`:

```typescript
// src/lib/pos-store/cart/model.ts
import { NksAPIState, defaultNksAPIState, SaleModel, SaleItemModel } from '@nks/shared-types';

export interface CartState {
  // Not API state — pure local UI state
  items: SaleItemModel[];
  customerId?: string;
  discountPercent: number;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'CREDIT';

  // Derived totals (computed in reducer)
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;

  // Mutation states (outbox write)
  completeSaleState: NksAPIState;
}

export const initialCartState: CartState = {
  items: [],
  customerId: undefined,
  discountPercent: 0,
  paymentMethod: 'CASH',
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 0,
  completeSaleState: { ...defaultNksAPIState },
};
```

```typescript
// src/lib/pos-store/cart/slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SaleItemModel } from '@nks/shared-types';
import { completeSale } from '@nks/api-manager';
import { CartState, initialCartState } from './model';

const recalcTotals = (state: CartState) => {
  state.subtotal      = state.items.reduce((s, i) => s + i.lineTotal, 0);
  state.taxAmount     = state.items.reduce((s, i) => s + i.taxAmount, 0);
  state.discountAmount = Math.round(state.subtotal * (state.discountPercent / 100));
  state.totalAmount   = state.subtotal + state.taxAmount - state.discountAmount;
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    addItem(state, action: PayloadAction<SaleItemModel>) {
      const existing = state.items.find(i => i.productId === action.payload.productId);
      if (existing) {
        existing.quantity      += action.payload.quantity;
        existing.taxAmount     += action.payload.taxAmount;
        existing.lineTotal     += action.payload.lineTotal;
      } else {
        state.items.push(action.payload);
      }
      recalcTotals(state);
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.productId !== action.payload);
      recalcTotals(state);
    },
    updateQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const item = state.items.find(i => i.productId === action.payload.productId);
      if (item) {
        const ratio         = action.payload.quantity / item.quantity;
        item.quantity       = action.payload.quantity;
        item.taxAmount      = Math.round(item.taxAmount * ratio);
        item.lineTotal      = Math.round(item.lineTotal * ratio);
      }
      recalcTotals(state);
    },
    setPaymentMethod(state, action: PayloadAction<CartState['paymentMethod']>) {
      state.paymentMethod = action.payload;
    },
    setDiscount(state, action: PayloadAction<number>) {
      state.discountPercent = action.payload;
      recalcTotals(state);
    },
    setCustomer(state, action: PayloadAction<string | undefined>) {
      state.customerId = action.payload;
    },
    clearCart(state) {
      Object.assign(state, initialCartState);
    },
  },
  extraReducers: (builder) => {
    // completeSale writes to WatermelonDB outbox — not a real network call
    builder.addCase(completeSale.pending, (state) => {
      state.completeSaleState.isLoading = true;
    });
    builder.addCase(completeSale.fulfilled, (state) => {
      state.completeSaleState.isLoading = false;
      // Cart cleared by dispatch(clearCart()) in component after success
    });
    builder.addCase(completeSale.rejected, (state, action) => {
      state.completeSaleState.isLoading  = false;
      state.completeSaleState.hasError   = true;
      state.completeSaleState.errors     = action.payload;
    });
  },
});

export const { addItem, removeItem, updateQuantity, setPaymentMethod,
               setDiscount, setCustomer, clearCart } = cartSlice.actions;
```

```typescript
// src/lib/shared-slice/connectivity/slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConnectivityState } from '@nks/shared-types';

interface ConnectivitySliceState {
  status: ConnectivityState['status'];
  lastCheckedAt: string;
  latencyMs?: number;
}

const initialState: ConnectivitySliceState = {
  status: 'ONLINE',
  lastCheckedAt: new Date().toISOString(),
};

export const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    setConnectivity(state, action: PayloadAction<ConnectivitySliceState>) {
      state.status        = action.payload.status;
      state.lastCheckedAt = action.payload.lastCheckedAt;
      state.latencyMs     = action.payload.latencyMs;
    },
  },
});

export const { setConnectivity } = connectivitySlice.actions;
```

```typescript
// src/lib/shared-slice/sync-status/slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncStatusState {
  pendingCount: number;   // outbox events not yet SYNCED
  deadCount: number;      // events failed 10 times
  lastSyncAt?: string;
  isSyncing: boolean;
}

const initialState: SyncStatusState = {
  pendingCount: 0,
  deadCount: 0,
  lastSyncAt: undefined,
  isSyncing: false,
};

export const syncStatusSlice = createSlice({
  name: 'syncStatus',
  initialState,
  reducers: {
    setSyncCounts(state, action: PayloadAction<{ pendingCount: number; deadCount: number }>) {
      state.pendingCount = action.payload.pendingCount;
      state.deadCount    = action.payload.deadCount;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setSyncComplete(state) {
      state.isSyncing  = false;
      state.lastSyncAt = new Date().toISOString();
    },
  },
});
```

### 5.3 Root Store

```typescript
// src/lib/store.ts
import { configureStore } from '@reduxjs/toolkit';

// shared
import { authSlice }         from './shared-slice/auth/slice';
import { connectivitySlice } from './shared-slice/connectivity/slice';
import { syncStatusSlice }   from './shared-slice/sync-status/slice';
import { shopConfigSlice }   from './shared-slice/shop-config/slice';

// POS
import { cartSlice }            from './pos-store/cart/slice';
import { productCatalogSlice }  from './pos-store/product-catalog/slice';
import { customerLookupSlice }  from './pos-store/customer-lookup/slice';

// Admin
import { productMgmtSlice }     from './admin-store/product-management/slice';
import { salesHistorySlice }    from './admin-store/sales-history/slice';
import { inventorySlice }       from './admin-store/inventory/slice';
import { customerMgmtSlice }    from './admin-store/customer-management/slice';

export const nksStore = configureStore({
  reducer: {
    // shared
    auth:          authSlice.reducer,
    connectivity:  connectivitySlice.reducer,
    syncStatus:    syncStatusSlice.reducer,
    shopConfig:    shopConfigSlice.reducer,

    // POS
    cart:            cartSlice.reducer,
    productCatalog:  productCatalogSlice.reducer,
    customerLookup:  customerLookupSlice.reducer,

    // Admin
    productMgmt:    productMgmtSlice.reducer,
    salesHistory:   salesHistorySlice.reducer,
    inventory:      inventorySlice.reducer,
    customerMgmt:   customerMgmtSlice.reducer,
  },
});

export type RootState   = ReturnType<typeof nksStore.getState>;
export type AppDispatch = typeof nksStore.dispatch;
```

---

## 6. Layer 4 — `nks-utils`

Mirrors `common/utils-and-constants`.

```
src/lib/
├── constants.ts          # GST rates, payment methods, invoice prefix
├── currency-utils.ts     # INR formatting, paise conversion
├── tax-utils.ts          # GST inclusive/exclusive calculation
├── invoice-utils.ts      # Invoice number generation, receipt formatting
├── date-utils.ts         # Shared with common — formatDate, getRelativeTime
└── object-transformer.ts # Re-export from common/utils (if shared)
```

```typescript
// currency-utils.ts
export const toRupees   = (paise: number): number => paise / 100;
export const toPaise    = (rupees: number): number => Math.round(rupees * 100);
export const formatINR  = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// tax-utils.ts
export const gstRates = [0, 5, 12, 18, 28] as const;
export type GSTRate = typeof gstRates[number];

export const addGST = (priceExcl: number, rate: GSTRate): number =>
  Math.round(priceExcl * (1 + rate / 100));

export const extractGST = (priceIncl: number, rate: GSTRate): number =>
  Math.round(priceIncl - priceIncl / (1 + rate / 100));

// invoice-utils.ts
export const generateInvoiceNumber = (prefix: string, seq: number): string =>
  `${prefix}${String(seq).padStart(6, '0')}`;

// Used for receipt display only — not for accounting
export const formatReceiptDate = (isoString: string): string =>
  new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
```

---

## 7. Complete Data Flow

### 7.1 POS Sale Flow (Happy Path — Online)

```
User scans barcode / taps product
    ↓
dispatch(addItem(item))          [cartSlice reducer — local, instant]
    ↓
User taps "Charge ₹X"
    ↓
dispatch(completeSale(sale))     [completeSale thunk — writes to WatermelonDB outbox]
    ↓
WatermelonDB database.write()    [5 outbox events: SALE_CREATED → INVOICE_GENERATED]
    ↓
completeSale.fulfilled           [cartSlice sets isLoading = false]
    ↓
dispatch(clearCart())            [component clears cart]
    ↓
Receipt displayed                [uses sale.deviceCreatedAt for timestamp]
    ↓ (async — queue worker)
OutboxWorker picks up PENDING events
    ↓
POST /api/v1/sync/outbox         [5 events per sale, 5 concurrent workers]
    ↓
Server processes, returns SYNCED ids
    ↓
WatermelonDB: update status → SYNCED
    ↓
dispatch(setSyncCounts({...}))   [syncStatusSlice — badge count updates]
```

### 7.2 POS Sale Flow (Offline)

Same as above through `dispatch(completeSale(sale))` — identical because:
- The thunk **always** writes to WatermelonDB outbox first
- OutboxWorker detects connectivity = OFFLINE, does not attempt POST
- Events stay PENDING with `nextRetryAt` computed
- On reconnect → connectivity probe → status becomes ONLINE → OutboxWorker drains queue

### 7.3 Product Catalog Load Flow

```
App launch / foreground focus
    ↓
DatabaseProvider initializes WatermelonDB
    ↓
dispatch(loadProductCatalog())   [productCatalogSlice thunk]
    ↓
Query WatermelonDB products table (synchronous via JSI)
    ↓
productCatalogSlice.fulfilled → state.response = products[]
    ↓
If connectivity = ONLINE:
    → dispatch(syncProductCatalog())  [fetch delta from server, update WatermelonDB]
```

### 7.4 Component Pattern (same as `common/`)

```typescript
// POS Screen
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@nks/state-manager';
import { addItem, completeSale } from '@nks/api-manager';

const POSScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const cart     = useSelector((s: RootState) => s.cart);
  const { status: connectivity } = useSelector((s: RootState) => s.connectivity);

  const handleAddItem = (product: ProductModel) => {
    const item = buildSaleItem(product);   // from nks-utils
    dispatch(addItem(item));
  };

  const handleCharge = async () => {
    const sale = buildSale(cart);          // from nks-utils
    await dispatch(completeSale(sale));
    dispatch(clearCart());
    navigation.navigate('Receipt', { sale });
  };

  return (/* JSX */);
};
```

---

## 8. `nks-mobile` App Wiring (`_layout.tsx`)

```typescript
// app/_layout.tsx
import { Provider as ReduxProvider } from 'react-redux';
import { nksStore } from '@nks/state-manager';
import { DatabaseProvider } from '@nks/mobile-utils';
import { ConnectivityProbe } from '@nks/mobile-utils';
import { OutboxWorker } from '@nks/mobile-utils';

export default function RootLayout() {
  return (
    <ReduxProvider store={nksStore}>
      <DatabaseProvider>
        <ConnectivityProbe />   {/* Pings /health every 30s, dispatches setConnectivity */}
        <OutboxWorker />        {/* Monitors outbox, drains on ONLINE */}
        <SafeAreaProvider>
          <MobileThemeProvider>
            <Stack />
          </MobileThemeProvider>
        </SafeAreaProvider>
      </DatabaseProvider>
    </ReduxProvider>
  );
}
```

`ConnectivityProbe` and `OutboxWorker` are **renderless components** (return `null`) that run background effects.

---

## 9. Build Order

| Phase | What to build | Package |
|---|---|---|
| **1** | `nks-shared-types` — all domain models + APIState | `libs-common/nks-shared-types` |
| **2** | `nks-utils` — currency, tax, invoice, date utils | `libs-common/nks-utils` |
| **3** | WatermelonDB schema + models + DatabaseProvider | `libs-mobile/mobile-utils` |
| **4** | `nks-api-manager` — api-handler + products module (reads) | `libs-common/nks-api-manager` |
| **5** | `nks-api-manager` — sales outbox-writer + completeSale thunk | `libs-common/nks-api-manager` |
| **6** | `nks-state-manager` — cart slice + connectivity slice | `libs-common/nks-state-manager` |
| **7** | `nks-state-manager` — syncStatus, auth, shopConfig slices | `libs-common/nks-state-manager` |
| **8** | ConnectivityProbe component (server ping → dispatch) | `libs-mobile/mobile-utils` |
| **9** | OutboxWorker (5-concurrent drain, exponential backoff) | `libs-mobile/mobile-utils` |
| **10** | POS screen: barcode scan → addItem → completeSale → receipt | `apps/nks-mobile` |
| **11** | Admin screens: product/customer/inventory CRUD | `apps/nks-mobile` |
| **12** | Sync endpoint on backend: POST /api/v1/sync/outbox | `apps/nks-backend` |

---

## 10. Package Dependency Graph

```
nks-shared-types
    ↑
nks-utils           (imports shared-types for currency/tax on ProductModel)
    ↑
nks-api-manager     (imports shared-types for models; imports mobile-utils for apiGet/apiPost)
    ↑
nks-state-manager   (imports api-manager thunks; imports shared-types for state shapes)
    ↑
nks-mobile          (imports all four libs-common packages)
```

No circular dependencies. Each layer only imports downward.

---

## 11. Key Rules (carried from offline-first-sync-architecture.md)

1. **Never call sales/payment API directly** — always write to outbox first
2. **UUID generated at event creation** — never regenerated on retry
3. **Deltas only** — inventory events store `-3`, never resulting quantity
4. **Two timestamps** — `deviceCreatedAt` for receipt display, `serverReceivedAt` for accounting
5. **Never block a sale** — negative inventory is allowed; flag and alert admin
6. **Idempotency** — `event.id` is the idempotency key; server deduplicates on it
7. **No NetInfo** — connectivity detected via server ping to `/api/v1/health`
8. **5 concurrent outbox workers** — 50 sales × 5 events = 250 events in ~10 rounds
