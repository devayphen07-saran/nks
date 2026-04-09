import { APIData, APIMethod } from "../api-handler";

// ─── Code Categories ──────────────────────────────────────────────────────

// 1. List all code categories (public)
export const GET_CODE_CATEGORIES: APIData = new APIData(
  "codes/categories",
  APIMethod.GET,
  { public: true }
);

// 2. Get all values for a category (public)
export const GET_CODE_VALUES: APIData = new APIData(
  "codes/:categoryCode",
  APIMethod.GET,
  { public: true }
);

// 3. Create a new code category (admin)
export const CREATE_CODE_CATEGORY: APIData = new APIData(
  "codes/categories",
  APIMethod.POST
);

// 4. Add a value to a category (admin)
export const CREATE_CODE_VALUE: APIData = new APIData(
  "codes/:categoryCode/values",
  APIMethod.POST
);

// 5. Update a code value (admin)
export const UPDATE_CODE_VALUE: APIData = new APIData(
  "codes/values/:id",
  APIMethod.PUT
);

// 6. Delete a code value (admin)
export const DELETE_CODE_VALUE: APIData = new APIData(
  "codes/values/:id",
  APIMethod.DELETE
);
