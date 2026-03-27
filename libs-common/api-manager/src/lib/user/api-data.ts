import { APIData, APIMethod } from "../api-handler";

export const GET_USER_DETAILS: APIData    = new APIData("user/me", APIMethod.GET);
export const UPDATE_USER_DETAILS: APIData = new APIData("user/me", APIMethod.PATCH);
export const VERIFY_USER_EMAIL: APIData   = new APIData("user/verify-email", APIMethod.POST);
