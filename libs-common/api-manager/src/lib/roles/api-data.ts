import { APIData, APIMethod } from "../api-handler";

// ─── Roles Management ──────────────────────────────────────────────────────
// Role management endpoints for STORE_OWNER to create/view/edit custom roles.
// Role assignment to staff happens during staff invite (not via separate endpoint).

// 1. Create a new custom role with entity permissions
export const CREATE_ROLE: APIData = new APIData(
  "roles",
  APIMethod.POST
);

// 2. View role details with all entity & route permissions
export const GET_ROLE: APIData = new APIData(
  "roles/:guuid",
  APIMethod.GET
);

// 3. Update role details and entity permissions
export const UPDATE_ROLE: APIData = new APIData(
  "roles/:guuid",
  APIMethod.PUT
);

