import { APIData, APIMethod } from "../api-handler";

// ─── Users Management ──────────────────────────────────────────────────────

export const LIST_ADMIN_USERS: APIData = new APIData(
  "admin/users",
  APIMethod.GET
);

export const GET_ADMIN_USER: APIData = new APIData(
  "admin/users/:userId",
  APIMethod.GET
);

export const UPDATE_ADMIN_USER: APIData = new APIData(
  "admin/users/:userId",
  APIMethod.PATCH
);

// ─── Stores Management ─────────────────────────────────────────────────────

export const LIST_ADMIN_STORES: APIData = new APIData(
  "admin/stores",
  APIMethod.GET
);

export const GET_ADMIN_STORE: APIData = new APIData(
  "admin/stores/:storeId",
  APIMethod.GET
);

export const UPDATE_ADMIN_STORE: APIData = new APIData(
  "admin/stores/:storeId",
  APIMethod.PATCH
);

// ─── Dashboard ────────────────────────────────────────────────────────────

export const GET_ADMIN_DASHBOARD: APIData = new APIData(
  "admin/dashboard",
  APIMethod.GET
);

// ─── Lookup Configuration ─────────────────────────────────────────────────

export const GET_LOOKUP_CONFIG: APIData = new APIData(
  "lookup-configuration",
  APIMethod.GET
);

export const UPDATE_LOOKUP_CONFIG: APIData = new APIData(
  "lookup-configuration/:configId",
  APIMethod.PATCH
);

// ─── Billing & Subscriptions ──────────────────────────────────────────────

export const GET_ADMIN_BILLING: APIData = new APIData(
  "admin/billing",
  APIMethod.GET
);

export const GET_ADMIN_SUBSCRIPTIONS: APIData = new APIData(
  "admin/subscriptions",
  APIMethod.GET
);

export const GET_ADMIN_SYSTEM_SETTINGS: APIData = new APIData(
  "admin/system-settings",
  APIMethod.GET
);

export const UPDATE_ADMIN_SYSTEM_SETTINGS: APIData = new APIData(
  "admin/system-settings",
  APIMethod.PATCH
);
