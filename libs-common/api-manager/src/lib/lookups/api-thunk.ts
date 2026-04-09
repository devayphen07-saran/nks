import {
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
