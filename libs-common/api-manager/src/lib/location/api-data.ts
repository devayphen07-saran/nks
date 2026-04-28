import { APIData, APIMethod } from "../api-handler";

// ─── States ────────────────────────────────────────────────────────────────

export const GET_STATES: APIData = new APIData(
  "location/states/list",
  APIMethod.GET,
  { public: true },
);

// ─── Districts ─────────────────────────────────────────────────────────────

export const GET_DISTRICTS_BY_STATE: APIData = new APIData(
  "location/states/:code/districts",
  APIMethod.GET,
  { public: true },
);

// ─── Pincodes ──────────────────────────────────────────────────────────────

export const GET_PINCODES_BY_DISTRICT: APIData = new APIData(
  "location/districts/:districtGuuid/pincodes",
  APIMethod.GET,
  { public: true },
);

export const GET_PINCODE_BY_CODE: APIData = new APIData(
  "location/pincodes/:code",
  APIMethod.GET,
  { public: true },
);

// ─── State Lookup ──────────────────────────────────────────────────────────

export const GET_STATE_BY_CODE: APIData = new APIData(
  "location/states/code/:code",
  APIMethod.GET,
  { public: true },
);
