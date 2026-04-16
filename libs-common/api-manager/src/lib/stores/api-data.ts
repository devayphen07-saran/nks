import { APIData, APIMethod } from "../api-handler";

// 1. Get stores for authenticated user (owned + staff)
export const GET_MY_STORES: APIData = new APIData("stores/me", APIMethod.GET);
