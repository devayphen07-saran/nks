import { APIData, APIMethod } from "../api-handler";

// ── User Routes ────────────────────────────────────────────────────────────────
// Fetch routes for the current authenticated user based on their roles

export const GET_USER_ROUTES: APIData = new APIData(
  "routes/me",
  APIMethod.GET,
  { public: false } // Requires authentication
);

// ── Admin Routes & Permissions ────────────────────────────────────────────────
// Fetch all system routes and permissions (SUPER_ADMIN only)

export const GET_ADMIN_ROUTES_PERMISSIONS: APIData = new APIData(
  "routes/admin/combined",
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
