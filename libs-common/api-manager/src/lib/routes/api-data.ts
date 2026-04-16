import { APIData, APIMethod } from "../api-handler";

// ─── Routes Navigation ──────────────────────────────────────────────────────
// Hierarchical navigation menu endpoints with permission flags.
// Returns routes based on user's role hierarchy (SUPER_ADMIN sees all,
// custom roles see only mapped routes).

// 1. Get admin routes for a user (SUPER_ADMIN only)
// userId in path — typically the logged-in admin's own ID
export const GET_ADMIN_ROUTES: APIData = new APIData(
  "routes/admin",
  APIMethod.GET
);

// 2. Get store-scoped routes for the calling user in a given store
export const GET_STORE_ROUTES: APIData = new APIData(
  "routes/store/:storeGuuid",
  APIMethod.GET
);
