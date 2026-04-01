// ============================================
// Export all lookup API thunks
// ============================================

export {
  // PUBLIC LOOKUPS (No Auth Required)
  getPublicDialCodes,
  getPublicCountries,
  fetchCountriesForPhoneSelection,
  fetchCountriesForStoreRegistration,

  // AUTHENTICATED LOOKUPS
  getLegalTypes,
  getStoreCategories,
  getSalutations,
  getDesignations,
  getAdminCountries,

  // BATCH LOOKUPS
  getConfig,
  fetchAllLookups,

  // LEGACY (Backward compatibility)
  getAllCountry,
} from "./api-thunk";

// Optional: Export APIData for advanced usage
export {
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
