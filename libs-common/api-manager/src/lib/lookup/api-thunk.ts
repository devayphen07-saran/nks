import {
  GET_PUBLIC_DIAL_CODES,
  GET_PUBLIC_COUNTRIES,
  GET_LEGAL_TYPES,
  GET_STORE_CATEGORIES,
  GET_SALUTATIONS,
  GET_DESIGNATIONS,
  GET_ADMIN_COUNTRIES,
  GET_CONFIG,
  GET_ALL_COUNTRY,
} from "./api-data";

// ============================================
// PUBLIC LOOKUPS (No Auth Required)
// ============================================

/**
 * Get all ACTIVE countries with dial codes
 * Used by: PhoneScreen for country selection
 * No authentication required
 */
export const getPublicDialCodes = GET_PUBLIC_DIAL_CODES.generateAsyncThunk(
  "lookup/publicDialCodes",
);

/**
 * Get all ACTIVE countries for store registration
 * Used by: Store registration form
 * No authentication required
 */
export const getPublicCountries = GET_PUBLIC_COUNTRIES.generateAsyncThunk(
  "lookup/publicCountries",
);

// ============================================
// AUTHENTICATED LOOKUPS
// ============================================

/**
 * Get all active store legal types
 * Used for: Store registration legal form
 * Requires: Bearer token
 */
export const getLegalTypes = GET_LEGAL_TYPES.generateAsyncThunk(
  "lookup/legalTypes",
);

/**
 * Get all active store categories
 * Used for: Store type/category selection
 * Requires: Bearer token
 */
export const getStoreCategories = GET_STORE_CATEGORIES.generateAsyncThunk(
  "lookup/storeCategories",
);

/**
 * Get all active salutations
 * Used for: Contact person form (Mr., Mrs., Dr., etc)
 * Requires: Bearer token
 */
export const getSalutations = GET_SALUTATIONS.generateAsyncThunk(
  "lookup/salutations",
);

/**
 * Get all active designations
 * Used for: Staff role/designation assignment
 * Requires: Bearer token
 */
export const getDesignations = GET_DESIGNATIONS.generateAsyncThunk(
  "lookup/designations",
);

/**
 * Get all countries (including inactive)
 * Used for: Admin dashboards, system management
 * Requires: Bearer token, Admin access
 */
export const getAdminCountries = GET_ADMIN_COUNTRIES.generateAsyncThunk(
  "lookup/adminCountries",
);

// ============================================
// BATCH LOOKUPS
// ============================================

/**
 * Get all configuration lookups at once
 * Returns: storeCategories, storeLegalTypes, salutations, designations, countries
 * Use this when you need multiple lookups to reduce API calls
 * Requires: Bearer token
 */
export const getConfig = GET_CONFIG.generateAsyncThunk("lookup/config");

// ============================================
// LEGACY (Backward compatibility)
// ============================================

/**
 * Legacy endpoint - kept for backward compatibility
 * Prefer getPublicCountries or getAdminCountries
 */
export const getAllCountry = GET_ALL_COUNTRY.generateAsyncThunk(
  "lookup/allCountries",
);

// ============================================
// CONVENIENCE EXPORTS
// For common use cases
// ============================================

/**
 * Get countries with dial codes (public endpoint)
 * Alias for getPublicDialCodes - for convenience
 * Use this in PhoneScreen and registration flows
 */
export const fetchCountriesForPhoneSelection = getPublicDialCodes;

/**
 * Get countries for store registration (public endpoint)
 * Alias for getPublicCountries - for convenience
 * Use this in store setup and registration forms
 */
export const fetchCountriesForStoreRegistration = getPublicCountries;

/**
 * Get all lookups for form initialization
 * Alias for getConfig - for convenience
 * Use this when initializing forms that need multiple lookups
 */
export const fetchAllLookups = getConfig;
