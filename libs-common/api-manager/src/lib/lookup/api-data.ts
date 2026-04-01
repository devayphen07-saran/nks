import { APIData, APIMethod } from "../api-handler";

// ============================================
// PUBLIC LOOKUPS (No Auth Required)
// For use during authentication/registration
// ============================================

/**
 * Get all ACTIVE countries with dial codes
 * Used for phone selection in PhoneScreen
 * PUBLIC endpoint - no auth required
 */
export const GET_PUBLIC_DIAL_CODES: APIData = new APIData(
  "lookups/public/dial-codes",
  APIMethod.GET,
  { public: true },
);

/**
 * Get all ACTIVE countries for store registration
 * PUBLIC endpoint - no auth required
 */
export const GET_PUBLIC_COUNTRIES: APIData = new APIData(
  "lookups/public/countries",
  APIMethod.GET,
  { public: true },
);

// ============================================
// AUTHENTICATED LOOKUPS (Bearer Token Required)
// For use after user is logged in
// ============================================

/**
 * Get all active store legal types
 * Used for store registration forms
 */
export const GET_LEGAL_TYPES: APIData = new APIData(
  "lookups/store-legal-types",
  APIMethod.GET,
);

/**
 * Get all active store categories
 * Used for store type selection
 */
export const GET_STORE_CATEGORIES: APIData = new APIData(
  "lookups/store-categories",
  APIMethod.GET,
);

/**
 * Get all active salutations (Mr., Mrs., Dr., etc)
 * Used for contact person forms
 */
export const GET_SALUTATIONS: APIData = new APIData(
  "lookups/salutations",
  APIMethod.GET,
);

/**
 * Get all active designations (Manager, Staff, etc)
 * Used for staff role assignment
 */
export const GET_DESIGNATIONS: APIData = new APIData(
  "lookups/designations",
  APIMethod.GET,
);

/**
 * Get all countries (admin access)
 * Returns all countries including inactive ones
 * Used for admin dashboards and system management
 */
export const GET_ADMIN_COUNTRIES: APIData = new APIData(
  "lookups/admin/countries",
  APIMethod.GET,
);

// ============================================
// BATCH LOOKUPS (Get Multiple at Once)
// ============================================

/**
 * Get all configuration lookups in a single call
 * Returns: storeCategories, storeLegalTypes, salutations,
 *          designations, countries
 * More efficient than individual calls
 */
export const GET_CONFIG: APIData = new APIData("lookups/config", APIMethod.GET);

// ============================================
// LEGACY LOOKUPS (Kept for compatibility)
// ============================================

/**
 * Legacy endpoint - kept for backward compatibility
 * Use GET_PUBLIC_COUNTRIES or GET_ADMIN_COUNTRIES instead
 */
export const GET_ALL_COUNTRY: APIData = new APIData(
  "location/countries",
  APIMethod.GET,
);
