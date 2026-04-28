import { APIData, APIMethod } from "../api-handler";

// 1. Get stores for authenticated user (owned + staff)
export const GET_MY_STORES: APIData = new APIData("stores/me", APIMethod.GET);

// 2. Set default store (204 No Content on success)
export const SET_DEFAULT_STORE: APIData = new APIData("stores/default", APIMethod.PUT);
