import {
  LIST_ADMIN_USERS,
  GET_ADMIN_USER,
  UPDATE_ADMIN_USER,
  LIST_ADMIN_STORES,
  GET_ADMIN_STORE,
  UPDATE_ADMIN_STORE,
  GET_ADMIN_DASHBOARD,
  GET_LOOKUP_CONFIG,
  UPDATE_LOOKUP_CONFIG,
  GET_ADMIN_BILLING,
  GET_ADMIN_SUBSCRIPTIONS,
  GET_ADMIN_SYSTEM_SETTINGS,
  UPDATE_ADMIN_SYSTEM_SETTINGS,
} from "./api-data";
import type {
  AdminListQuery,
  UpdateAdminUserRequest,
  UpdateAdminStoreRequest,
  UpdateLookupConfigRequest,
  UpdateSystemSettingsRequest,
} from "./request-dto";

// ─── Users Management ────────────────────────────────────────────────────

export const listAdminUsers = LIST_ADMIN_USERS.generateAsyncThunk<AdminListQuery>(
  "admin/listAdminUsers"
);

export const getAdminUser = GET_ADMIN_USER.generateAsyncThunk(
  "admin/getAdminUser"
);

export const updateAdminUser = UPDATE_ADMIN_USER.generateAsyncThunk<UpdateAdminUserRequest>(
  "admin/updateAdminUser"
);

// ─── Stores Management ──────────────────────────────────────────────────

export const listAdminStores = LIST_ADMIN_STORES.generateAsyncThunk<AdminListQuery>(
  "admin/listAdminStores"
);

export const getAdminStore = GET_ADMIN_STORE.generateAsyncThunk(
  "admin/getAdminStore"
);

export const updateAdminStore = UPDATE_ADMIN_STORE.generateAsyncThunk<UpdateAdminStoreRequest>(
  "admin/updateAdminStore"
);

// ─── Dashboard ────────────────────────────────────────────────────────

export const getAdminDashboard = GET_ADMIN_DASHBOARD.generateAsyncThunk(
  "admin/getAdminDashboard"
);

// ─── Lookup Configuration ────────────────────────────────────────────────

export const getLookupConfig = GET_LOOKUP_CONFIG.generateAsyncThunk(
  "admin/getLookupConfig"
);

export const updateLookupConfig = UPDATE_LOOKUP_CONFIG.generateAsyncThunk<UpdateLookupConfigRequest>(
  "admin/updateLookupConfig"
);

// ─── Billing & Subscriptions ───────────────────────────────────────────

export const getAdminBilling = GET_ADMIN_BILLING.generateAsyncThunk(
  "admin/getAdminBilling"
);

export const getAdminSubscriptions = GET_ADMIN_SUBSCRIPTIONS.generateAsyncThunk(
  "admin/getAdminSubscriptions"
);

export const getAdminSystemSettings = GET_ADMIN_SYSTEM_SETTINGS.generateAsyncThunk(
  "admin/getAdminSystemSettings"
);

export const updateAdminSystemSettings = UPDATE_ADMIN_SYSTEM_SETTINGS.generateAsyncThunk<UpdateSystemSettingsRequest>(
  "admin/updateAdminSystemSettings"
);
