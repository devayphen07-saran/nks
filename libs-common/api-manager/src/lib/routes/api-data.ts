import { APIData, APIMethod } from "../api-handler";

// ── Admin Routes & Permissions ────────────────────────────────────────────────
// Fetch all system routes and permissions (SUPER_ADMIN only)

export const GET_ADMIN_ROUTES_PERMISSIONS: APIData = new APIData(
  "auth/admin/routes-permissions",
  APIMethod.GET,
  { public: false } // Requires authentication and SUPER_ADMIN role
);

// ── Store Routes ──────────────────────────────────────────────────────────────
// Fetch store-specific routes for authenticated users

export const GET_STORE_ROUTES: APIData = new APIData(
  "store/dashboard/routes",
  APIMethod.GET,
  { public: false } // Requires authentication
);
