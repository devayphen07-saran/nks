import { APIData, APIMethod } from "../api-handler";

// ─── Lookup Reference Data ─────────────────────────────────────────────────

export const GET_SALUTATIONS: APIData = new APIData(
  "lookups/salutations",
  APIMethod.GET,
  { public: true },
);

export const GET_COUNTRIES: APIData = new APIData(
  "lookups/countries",
  APIMethod.GET,
  { public: true },
);

export const GET_ADDRESS_TYPES: APIData = new APIData(
  "lookups/address-types",
  APIMethod.GET,
  { public: true },
);

export const GET_COMMUNICATION_TYPES: APIData = new APIData(
  "lookups/communication-types",
  APIMethod.GET,
  { public: true },
);

export const GET_DESIGNATIONS: APIData = new APIData(
  "lookups/designations",
  APIMethod.GET,
  { public: true },
);

export const GET_STORE_LEGAL_TYPES: APIData = new APIData(
  "lookups/store-legal-types",
  APIMethod.GET,
  { public: true },
);

export const GET_STORE_CATEGORIES: APIData = new APIData(
  "lookups/store-categories",
  APIMethod.GET,
  { public: true },
);

export const GET_CURRENCIES: APIData = new APIData(
  "lookups/currencies",
  APIMethod.GET,
  { public: true },
);

export const GET_VOLUMES: APIData = new APIData(
  "lookups/volumes",
  APIMethod.GET,
  { public: true },
);

// ─── Admin: Lookup Configuration ────────────────────────────────────────────

export const GET_LOOKUP_TYPES: APIData = new APIData(
  "lookups/admin",
  APIMethod.GET,
);

export const GET_LOOKUP_VALUES: APIData = new APIData(
  "lookups/admin/code",
  APIMethod.GET,
);

export const CREATE_LOOKUP_VALUE: APIData = new APIData(
  "lookups/admin/code",
  APIMethod.POST,
);

export const UPDATE_LOOKUP_VALUE: APIData = new APIData(
  "lookups/admin/code/id",
  APIMethod.PUT,
);

export const DELETE_LOOKUP_VALUE: APIData = new APIData(
  "lookups/admin/code/id",
  APIMethod.DELETE,
);

// ─── Store Categories ──────────────────────────────────────────────────────

export const GET_STORE_CATEGORIES_ADMIN: APIData = new APIData(
  "lookups/store-categories",
  APIMethod.GET,
);

export const CREATE_STORE_CATEGORY: APIData = new APIData(
  "lookups/store-categories",
  APIMethod.POST,
);

export const UPDATE_STORE_CATEGORY: APIData = new APIData(
  "lookups/store-categories/id",
  APIMethod.PUT,
);

export const DELETE_STORE_CATEGORY: APIData = new APIData(
  "lookups/store-categories/id",
  APIMethod.DELETE,
);

// ─── Store Legal Types ─────────────────────────────────────────────────────

export const GET_STORE_LEGAL_TYPES_ADMIN: APIData = new APIData(
  "lookups/store-legal-types",
  APIMethod.GET,
);

export const CREATE_STORE_LEGAL_TYPE: APIData = new APIData(
  "lookups/store-legal-types",
  APIMethod.POST,
);

export const UPDATE_STORE_LEGAL_TYPE: APIData = new APIData(
  "lookups/store-legal-types/id",
  APIMethod.PUT,
);

export const DELETE_STORE_LEGAL_TYPE: APIData = new APIData(
  "lookups/store-legal-types/id",
  APIMethod.DELETE,
);

// ─── Salutations ───────────────────────────────────────────────────────────

export const CREATE_SALUTATION: APIData = new APIData(
  "lookups/salutations",
  APIMethod.POST,
);

export const UPDATE_SALUTATION: APIData = new APIData(
  "lookups/salutations/id",
  APIMethod.PUT,
);

export const DELETE_SALUTATION: APIData = new APIData(
  "lookups/salutations/id",
  APIMethod.DELETE,
);

// ─── Countries ─────────────────────────────────────────────────────────────

export const CREATE_COUNTRY: APIData = new APIData(
  "lookups/countries",
  APIMethod.POST,
);

export const UPDATE_COUNTRY: APIData = new APIData(
  "lookups/countries/id",
  APIMethod.PUT,
);

export const DELETE_COUNTRY: APIData = new APIData(
  "lookups/countries/id",
  APIMethod.DELETE,
);

// ─── Designations ──────────────────────────────────────────────────────────

export const CREATE_DESIGNATION: APIData = new APIData(
  "lookups/designations",
  APIMethod.POST,
);

export const UPDATE_DESIGNATION: APIData = new APIData(
  "lookups/designations/id",
  APIMethod.PUT,
);

export const DELETE_DESIGNATION: APIData = new APIData(
  "lookups/designations/id",
  APIMethod.DELETE,
);

// ─── Subscription Plan Types ────────────────────────────────────────────────

export const GET_SUBSCRIPTION_PLAN_TYPES: APIData = new APIData(
  "lookups/subscription/plan-types",
  APIMethod.GET,
);

// ─── Subscription Billing Frequencies ───────────────────────────────────────

export const GET_SUBSCRIPTION_BILLING_FREQUENCIES: APIData = new APIData(
  "lookups/subscription/billing-frequencies",
  APIMethod.GET,
);

// ─── Subscription Currencies ────────────────────────────────────────────────

export const GET_SUBSCRIPTION_CURRENCIES: APIData = new APIData(
  "lookups/subscription/currencies",
  APIMethod.GET,
);

// ─── Subscription Statuses ─────────────────────────────────────────────────

export const GET_SUBSCRIPTION_STATUSES: APIData = new APIData(
  "lookups/subscription/statuses",
  APIMethod.GET,
);
