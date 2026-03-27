# Mobile Auth Integration Guide

> Complete mobile authentication flow with OTP login, profile completion, and store selection.
> Uses **Part A (Redux Thunk)** for global auth state and **Part B (TanStack Query)** for store listings.

---

## Overview: Mobile Auth Flow

```
1. Phone OTP Login Flow
   POST /auth/otp/send { phone }
   ↓
   User receives SMS
   ↓
   POST /auth/otp/verify { phone, otp, reqId }
   ↓
   Logged in! (Redux auth state updated)

2. Profile Completion Check
   GET /auth/get-session
   ↓
   Check: profileCompleted, emailVerified

   If NOT complete:
   POST /auth/profile/complete { name, email, password }
   ↓
   POST /auth/otp/email/verify { email, otp }
   ↓
   Profile done!

3. Store Selection
   GET /stores (TanStack Query)
   ↓
   User selects store
   ↓
   POST /auth/store/select { storeId }
   ↓
   Navigation to store dashboard
```

---

## Step 1: Setup Redux Thunk for Auth (Part A)

### Step A-1: Register Path Params

**File:** `libs-common/api-manager/src/lib/api-handler.ts`

```typescript
type PossibleTypeId =
  | "shopId"
  | "productId"
  | "saleId"
  | "customerId"
  | "invoiceId"
  | "categoryId"
  | "userId"
  | "storeId"        // ← ADD THIS
  | "outboxEventId"
  | "guuid"
  | "id";
```

---

### Step A-2: Define Auth Types

**File:** `libs-common/api-manager/src/lib/auth/request-dto.ts`

```typescript
import type { ApiResponse } from "@nks/shared-types";

// ── OTP Login ──────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  phone: string;
}

export interface SendOtpResponse {
  requestId: string;
  message: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  reqId: string;
}

// ── Session & Auth Response ────────────────────────────────────────────────

export interface UserInfo {
  id: number;
  email: string | null;
  name: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
}

export interface SessionToken {
  token: string;
  expiresAt: string;
}

export interface AccessControl {
  roles: Array<{
    roleCode: "SUPER_ADMIN" | "STORE_OWNER" | "STAFF" | "CUSTOMER";
    storeId: number | null;
    storeName: string | null;
  }>;
  permissions: string[];
  isSuperAdmin: boolean;
  activeStoreId: number | null;
  userType: "SUPER_ADMIN" | "STORE_OWNER" | "STAFF" | "PERSONAL" | "UNSET";
}

export interface AuthResponse {
  user: UserInfo;
  token: string;
  session: SessionToken;
  access: AccessControl;
}

// ── Profile Completion ─────────────────────────────────────────────────────

export interface ProfileCompleteRequest {
  name: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
}

export interface ProfileCompleteResponse {
  emailVerificationSent: boolean;
  phoneVerificationSent: boolean;
  nextStep: "verifyEmail" | "verifyPhone" | "complete";
  message: string;
}

// ── Store Selection ────────────────────────────────────────────────────────

export interface StoreSelectRequest {
  storeId: number;
}

export type OtpSendResponse = ApiResponse<SendOtpResponse>;
export type VerifyOtpResponse = ApiResponse<AuthResponse>;
export type GetSessionResponse = ApiResponse<AuthResponse>;
export type ProfileCompleteApiResponse = ApiResponse<ProfileCompleteResponse>;
export type StoreSelectResponse = ApiResponse<AccessControl>;
```

---

### Step A-3: Define API Endpoints

**File:** `libs-common/api-manager/src/lib/auth/api-data.ts`

```typescript
import { APIData, APIMethod } from "../api-handler";

// Public endpoints (no auth required)
export const SEND_OTP = new APIData("auth/otp/send", APIMethod.POST, { public: true });
export const VERIFY_OTP = new APIData("auth/otp/verify", APIMethod.POST, { public: true });

// Authenticated endpoints
export const GET_SESSION = new APIData("auth/get-session", APIMethod.GET);
export const PROFILE_COMPLETE = new APIData("auth/profile/complete", APIMethod.POST);
export const STORE_SELECT = new APIData("auth/store/select", APIMethod.POST);
```

---

### Step A-4: Create Thunks

**File:** `libs-common/api-manager/src/lib/auth/api-thunk.ts`

```typescript
import {
  SEND_OTP,
  VERIFY_OTP,
  GET_SESSION,
  PROFILE_COMPLETE,
  STORE_SELECT,
} from "./api-data";
import type {
  SendOtpRequest,
  VerifyOtpRequest,
  ProfileCompleteRequest,
  StoreSelectRequest,
} from "./request-dto";

// OTP Login thunks
export const sendOtp = SEND_OTP.generateAsyncThunk<SendOtpRequest>(
  "auth/sendOtp"
);
export const verifyOtp = VERIFY_OTP.generateAsyncThunk<VerifyOtpRequest>(
  "auth/verifyOtp"
);

// Session thunks
export const getSession = GET_SESSION.generateAsyncThunk(
  "auth/getSession"
);
export const profileComplete = PROFILE_COMPLETE.generateAsyncThunk<ProfileCompleteRequest>(
  "auth/profileComplete"
);
export const storeSelect = STORE_SELECT.generateAsyncThunk<StoreSelectRequest>(
  "auth/storeSelect"
);
```

---

### Step A-5: Module Index

**File:** `libs-common/api-manager/src/lib/auth/index.ts`

```typescript
export * from "./request-dto";
export * from "./api-data";
export * from "./api-thunk";
```

---

### Step A-6: Export from api-manager

**File:** `libs-common/api-manager/src/index.ts`

```typescript
export * from './lib/auth';   // ← add
```

---

### Step A-7: Create Redux Slice

**File:** `libs-common/state-manager/src/lib/shared-slice/auth/model.ts`

```typescript
import type { APIState, AuthResponse } from "@nks/shared-types";

export interface AuthSliceState {
  // OTP Login flow
  sendOtpState: APIState;
  verifyOtpState: APIState;

  // Session & profile
  sessionState: APIState;
  profileCompleteState: APIState;
  storeSelectState: APIState;

  // Current auth data
  user: AuthResponse | null;
  token: string | null;
  isAuthenticated: boolean;
}
```

**File:** `libs-common/state-manager/src/lib/shared-slice/auth/slice.ts`

```typescript
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  sendOtp,
  verifyOtp,
  getSession,
  profileComplete,
  storeSelect,
} from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import type { AuthResponse } from "@nks/api-manager";
import type { AuthSliceState } from "./model";

const initialState: AuthSliceState = {
  sendOtpState: { ...defaultAPIState },
  verifyOtpState: { ...defaultAPIState },
  sessionState: { ...defaultAPIState },
  profileCompleteState: { ...defaultAPIState },
  storeSelectState: { ...defaultAPIState },
  user: null,
  token: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    /* Send OTP */
    builder.addCase(sendOtp.pending, (state) => {
      state.sendOtpState.isLoading = true;
      state.sendOtpState.hasError = false;
    });
    builder.addCase(sendOtp.fulfilled, (state, action) => {
      state.sendOtpState.isLoading = false;
      state.sendOtpState.response = action.payload?.data;
    });
    builder.addCase(sendOtp.rejected, (state, action) => {
      state.sendOtpState.isLoading = false;
      state.sendOtpState.hasError = true;
      state.sendOtpState.errors = action.payload;
    });

    /* Verify OTP */
    builder.addCase(verifyOtp.pending, (state) => {
      state.verifyOtpState.isLoading = true;
      state.verifyOtpState.hasError = false;
    });
    builder.addCase(verifyOtp.fulfilled, (state, action) => {
      state.verifyOtpState.isLoading = false;
      const data = action.payload?.data as AuthResponse | undefined;
      state.user = data || null;
      state.token = data?.token || null;
      state.isAuthenticated = !!data;
      state.verifyOtpState.response = data;
    });
    builder.addCase(verifyOtp.rejected, (state, action) => {
      state.verifyOtpState.isLoading = false;
      state.verifyOtpState.hasError = true;
      state.verifyOtpState.errors = action.payload;
    });

    /* Get Session */
    builder.addCase(getSession.pending, (state) => {
      state.sessionState.isLoading = true;
      state.sessionState.hasError = false;
    });
    builder.addCase(getSession.fulfilled, (state, action) => {
      state.sessionState.isLoading = false;
      const data = action.payload?.data as AuthResponse | undefined;
      state.user = data || null;
      state.sessionState.response = data;
    });
    builder.addCase(getSession.rejected, (state, action) => {
      state.sessionState.isLoading = false;
      state.sessionState.hasError = true;
      state.sessionState.errors = action.payload;
      state.isAuthenticated = false;
    });

    /* Profile Complete */
    builder.addCase(profileComplete.pending, (state) => {
      state.profileCompleteState.isLoading = true;
      state.profileCompleteState.hasError = false;
    });
    builder.addCase(profileComplete.fulfilled, (state, action) => {
      state.profileCompleteState.isLoading = false;
      state.profileCompleteState.response = action.payload?.data;
    });
    builder.addCase(profileComplete.rejected, (state, action) => {
      state.profileCompleteState.isLoading = false;
      state.profileCompleteState.hasError = true;
      state.profileCompleteState.errors = action.payload;
    });

    /* Store Select */
    builder.addCase(storeSelect.pending, (state) => {
      state.storeSelectState.isLoading = true;
      state.storeSelectState.hasError = false;
    });
    builder.addCase(storeSelect.fulfilled, (state, action) => {
      state.storeSelectState.isLoading = false;
      const access = action.payload?.data;
      if (state.user && access) {
        state.user.access = access;
      }
      state.storeSelectState.response = access;
    });
    builder.addCase(storeSelect.rejected, (state, action) => {
      state.storeSelectState.isLoading = false;
      state.storeSelectState.hasError = true;
      state.storeSelectState.errors = action.payload;
    });
  },
});

export const { clearAuth } = authSlice.actions;
```

---

### Step A-8: Register in Base Store

**File:** `libs-common/state-manager/src/lib/base-reducer.ts`

```typescript
import { authSlice } from "./shared-slice/auth/slice";

export const baseReducer = {
  auth: authSlice.reducer,
  // ... other slices
};
```

---

## Step 2: Setup TanStack Query for Stores (Part B)

### Step B-1: Define Store Types

**File:** `libs-common/api-handler/src/lib/stores/types.ts`

```typescript
import type { ApiResponse } from "@nks/shared-types";

export interface StoreListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface StoreListItem {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phoneNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreListResponse {
  items: StoreListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StoreDetail {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phoneNumber: string | null;
  email: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreDetailResponse = ApiResponse<StoreDetail>;
export type StoreListApiResponse = ApiResponse<StoreListResponse>;
```

---

### Step B-2: Define Store Endpoints

**File:** `libs-common/api-handler/src/lib/stores/api-data.ts`

```typescript
export const STORE_ENDPOINTS = {
  LIST: "stores",
  DETAIL: "stores/storeId",
} as const;

export function buildStoreUrl(
  endpoint: string,
  params?: { storeId?: string | number }
): string {
  let url = endpoint;
  if (params?.storeId !== undefined) {
    url = url.replace("{storeId}", String(params.storeId));
  }
  return url;
}
```

---

### Step B-3: Create Store Query Hooks

**File:** `libs-common/api-handler/src/lib/stores/tanstack-queries.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { API } from "@nks/api-manager";
import { STORE_ENDPOINTS, buildStoreUrl } from "./api-data";
import type {
  StoreListParams,
  StoreListApiResponse,
  StoreDetailResponse,
} from "./types";

export const storeKeys = {
  all: ["stores"] as const,
  lists: () => [...storeKeys.all, "list"] as const,
  list: (params?: StoreListParams) =>
    [...storeKeys.lists(), params] as const,
  details: () => [...storeKeys.all, "detail"] as const,
  detail: (storeId: string | number) =>
    [...storeKeys.details(), storeId] as const,
};

/**
 * Get list of stores user has access to
 * Called after profile completion and store selection
 */
export function useStores(
  params?: StoreListParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: storeKeys.list(params),
    queryFn: async () => {
      const url = buildStoreUrl(STORE_ENDPOINTS.LIST);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.pageSize) queryParams.set("pageSize", String(params.pageSize));
      if (params?.search) queryParams.set("search", params.search);

      const qs = queryParams.toString();
      const response = await API.get<StoreListApiResponse>(
        qs ? `${url}?${qs}` : url
      );
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get store details
 */
export function useStore(
  storeId: string | number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: async () => {
      const url = buildStoreUrl(STORE_ENDPOINTS.DETAIL, { storeId });
      const response = await API.get<StoreDetailResponse>(url);
      return response.data;
    },
    enabled: options?.enabled ?? !!storeId,
  });
}
```

---

### Step B-4: Module Index

**File:** `libs-common/api-handler/src/lib/stores/index.ts`

```typescript
export type {
  StoreListParams,
  StoreListItem,
  StoreListResponse,
  StoreDetail,
  StoreDetailResponse,
} from "./types";

export { STORE_ENDPOINTS, buildStoreUrl } from "./api-data";
export { storeKeys, useStores, useStore } from "./tanstack-queries";
```

---

### Step B-5: Export from api-handler

**File:** `libs-common/api-handler/src/index.ts`

```typescript
export * from "./lib/stores";
```

---

## Step 3: Mobile UI Components

### Login Screen

```typescript
"use client";

import { useState } from "react";
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { sendOtp, verifyOtp } from "@nks/api-manager";

export function LoginScreen() {
  const dispatch = useBaseStoreDispatch();
  const { sendOtpState, verifyOtpState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [reqId, setReqId] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const handleSendOtp = async () => {
    try {
      const result = await dispatch(sendOtp({ bodyParam: { phone } })).unwrap();
      setReqId(result.data.requestId);
      setStep("otp");
    } catch (error) {
      console.error("Failed to send OTP:", error);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await dispatch(
        verifyOtp({ bodyParam: { phone, otp, reqId } })
      ).unwrap();
      // Navigate to profile completion
    } catch (error) {
      console.error("Failed to verify OTP:", error);
    }
  };

  if (step === "phone") {
    return (
      <div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number"
        />
        <button
          onClick={handleSendOtp}
          disabled={sendOtpState.isLoading}
        >
          {sendOtpState.isLoading ? "Sending..." : "Send OTP"}
        </button>
        {sendOtpState.hasError && <p>Error: {sendOtpState.errors}</p>}
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Enter 6-digit OTP"
        maxLength={6}
      />
      <button
        onClick={handleVerifyOtp}
        disabled={verifyOtpState.isLoading}
      >
        {verifyOtpState.isLoading ? "Verifying..." : "Verify OTP"}
      </button>
      {verifyOtpState.hasError && <p>Error: {verifyOtpState.errors}</p>}
    </div>
  );
}
```

---

### Profile Completion Screen

```typescript
"use client";

import { useState } from "react";
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { profileComplete } from "@nks/api-manager";

export function ProfileCompletionScreen() {
  const dispatch = useBaseStoreDispatch();
  const { profileCompleteState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleComplete = async () => {
    try {
      const result = await dispatch(
        profileComplete({
          bodyParam: { name, email, password },
        })
      ).unwrap();

      // Check if email verification needed
      if (result.data.nextStep === "verifyEmail") {
        // Navigate to email verification screen
      } else if (result.data.nextStep === "complete") {
        // Navigate to store selection
      }
    } catch (error) {
      console.error("Failed to complete profile:", error);
    }
  };

  return (
    <div>
      <h2>Complete Your Profile</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button
        onClick={handleComplete}
        disabled={profileCompleteState.isLoading}
      >
        {profileCompleteState.isLoading ? "Completing..." : "Complete Profile"}
      </button>
    </div>
  );
}
```

---

### Store Selection Screen

```typescript
"use client";

import { useStores } from "@nks/api-handler";
import { useBaseStoreDispatch, useBaseStoreSelector, type BaseStoreRootState } from "@nks/state-manager";
import { storeSelect } from "@nks/api-manager";

export function StoreSelectionScreen() {
  const dispatch = useBaseStoreDispatch();
  const { storeSelectState } = useBaseStoreSelector(
    (state: BaseStoreRootState) => state.auth
  );

  const { data, isLoading, error } = useStores();
  const stores = data?.items ?? [];

  const handleSelectStore = async (storeId: number) => {
    try {
      await dispatch(
        storeSelect({ bodyParam: { storeId } })
      ).unwrap();
      // Navigate to store dashboard
    } catch (error) {
      console.error("Failed to select store:", error);
    }
  };

  if (isLoading) return <div>Loading stores...</div>;
  if (error) return <div>Error loading stores</div>;

  return (
    <div>
      <h2>Select a Store</h2>
      <div>
        {stores.map((store) => (
          <div
            key={store.id}
            onClick={() => handleSelectStore(store.id)}
            style={{ padding: "16px", border: "1px solid #ccc", margin: "8px" }}
          >
            <h3>{store.name}</h3>
            <p>{store.city}</p>
            <button disabled={storeSelectState.isLoading}>
              {storeSelectState.isLoading ? "Selecting..." : "Select"}
            </button>
          </div>
        ))}
      </div>
      {stores.length === 0 && <p>No stores available</p>}
    </div>
  );
}
```

---

## Complete Flow Checklist

- [ ] Auth DTOs created in `api-manager/src/lib/auth/request-dto.ts`
- [ ] Auth endpoints defined in `api-manager/src/lib/auth/api-data.ts`
- [ ] Auth thunks created in `api-manager/src/lib/auth/api-thunk.ts`
- [ ] Auth slice created in `state-manager/src/lib/shared-slice/auth/slice.ts`
- [ ] Auth slice registered in `state-manager/src/lib/base-reducer.ts`
- [ ] Store types defined in `api-handler/src/lib/stores/types.ts`
- [ ] Store endpoints defined in `api-handler/src/lib/stores/api-data.ts`
- [ ] Store query hooks created in `api-handler/src/lib/stores/tanstack-queries.ts`
- [ ] LoginScreen component using `sendOtp` and `verifyOtp` thunks
- [ ] ProfileCompletionScreen component using `profileComplete` thunk
- [ ] StoreSelectionScreen component using `useStores` query and `storeSelect` thunk
- [ ] Navigation flow wired between screens
- [ ] Token persisted to localStorage/AsyncStorage (mobile)

---

## Navigation Flow

```
LoginScreen
  ↓ (verifyOtp success)
ProfileCompletionScreen
  ↓ (profileComplete success & nextStep === "complete")
StoreSelectionScreen
  ↓ (storeSelect success)
StoreDashboard / StoreListPage
```

