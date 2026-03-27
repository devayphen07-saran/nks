import {
  GET_ADMIN_ROUTES_PERMISSIONS,
  GET_STORE_ROUTES,
} from "./api-data";
import type { FetchRoutesRequest } from "./request-dto";

// ── Admin Routes & Permissions Thunk ──────────────────────────────────────────

/**
 * Fetch all system routes and permissions for SUPER_ADMIN users
 * Used to populate admin panel navigation and permission management
 */
export const fetchAdminRoutesAndPermissions = GET_ADMIN_ROUTES_PERMISSIONS.generateAsyncThunk<FetchRoutesRequest>(
  "routes/fetchAdminRoutesAndPermissions"
);

// ── Store Routes Thunk ────────────────────────────────────────────────────────

/**
 * Fetch store-specific routes for authenticated users
 * Used to populate user dashboard navigation based on their store and role
 */
export const fetchStoreRoutes = GET_STORE_ROUTES.generateAsyncThunk<FetchRoutesRequest>(
  "routes/fetchStoreRoutes"
);
