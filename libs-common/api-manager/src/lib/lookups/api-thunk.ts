import {
  GET_PUBLIC_LOOKUP,
  GET_SALUTATIONS,
  GET_COUNTRIES,
  GET_ADDRESS_TYPES,
  GET_COMMUNICATION_TYPES,
  GET_DESIGNATIONS,
  GET_STORE_LEGAL_TYPES,
  GET_STORE_CATEGORIES,
  GET_CURRENCIES,
  GET_VOLUMES,
} from "./api-data";

// ─── Generic Public Lookup ──────────────────────────────────────────────────
// Use this for any lookup type that doesn't have a per-type thunk below.
// Caller passes the lookup_type.code (or kebab-slug) via pathParam.typeCode.

export const getPublicLookup = GET_PUBLIC_LOOKUP.generateAsyncThunk(
  "lookups/getPublicLookup"
);

// ─── Salutations ────────────────────────────────────────────────────────────

export const getSalutations = GET_SALUTATIONS.generateAsyncThunk(
  "lookups/getSalutations"
);

// ─── Countries ──────────────────────────────────────────────────────────────

export const getCountries = GET_COUNTRIES.generateAsyncThunk(
  "lookups/getCountries"
);

// ─── Address Types ──────────────────────────────────────────────────────────

export const getAddressTypes = GET_ADDRESS_TYPES.generateAsyncThunk(
  "lookups/getAddressTypes"
);

// ─── Communication Types ────────────────────────────────────────────────────

export const getCommunicationTypes = GET_COMMUNICATION_TYPES.generateAsyncThunk(
  "lookups/getCommunicationTypes"
);

// ─── Designations ───────────────────────────────────────────────────────────

export const getDesignations = GET_DESIGNATIONS.generateAsyncThunk(
  "lookups/getDesignations"
);

// ─── Store Legal Types ──────────────────────────────────────────────────────

export const getStoreLegalTypes = GET_STORE_LEGAL_TYPES.generateAsyncThunk(
  "lookups/getStoreLegalTypes"
);

// ─── Store Categories ───────────────────────────────────────────────────────

export const getStoreCategories = GET_STORE_CATEGORIES.generateAsyncThunk(
  "lookups/getStoreCategories"
);

// ─── Currencies ─────────────────────────────────────────────────────────────

export const getCurrencies = GET_CURRENCIES.generateAsyncThunk(
  "lookups/getCurrencies"
);

// ─── Volumes ────────────────────────────────────────────────────────────────

export const getVolumes = GET_VOLUMES.generateAsyncThunk("lookups/getVolumes");
