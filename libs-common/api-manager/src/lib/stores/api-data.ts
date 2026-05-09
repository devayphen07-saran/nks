import { APIData, APIMethod } from "../api-handler";

// 1. Create a store for the authenticated user (returns 201 with { storeGuuid })
export const CREATE_STORE: APIData = new APIData("stores", APIMethod.POST);

// 2. Get stores for authenticated user (owned + staff)
export const GET_MY_STORES: APIData = new APIData("stores/me", APIMethod.GET);

// 3. Set default store (204 No Content on success)
export const SET_DEFAULT_STORE: APIData = new APIData("stores/default", APIMethod.PUT);
