import { APIData, APIMethod } from "../api-handler";

export const GET_USER_DETAILS: APIData = new APIData("users/me", APIMethod.GET);
export const UPDATE_USER_DETAILS: APIData = new APIData(
  "users/me",
  APIMethod.PATCH,
);
export const VERIFY_USER_EMAIL: APIData = new APIData(
  "users/verify-email",
  APIMethod.POST,
);

export const GET_USER_PREFERENCES: APIData = new APIData(
  "users/me/preferences",
  APIMethod.GET,
);
export const UPDATE_USER_PREFERENCES: APIData = new APIData(
  "users/me/preferences",
  APIMethod.PATCH,
);
export const UPDATE_THEME: APIData = new APIData(
  "users/me/preferences/theme",
  APIMethod.PATCH,
);
export const UPDATE_TIMEZONE: APIData = new APIData(
  "users/me/preferences/timezone",
  APIMethod.PATCH,
);
