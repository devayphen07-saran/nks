import { APIData, APIMethod } from "../api-handler";

export const LOGIN: APIData = new APIData("auth/login", APIMethod.POST, {
  public: true,
});

export const REGISTER: APIData = new APIData("auth/register", APIMethod.POST, {
  public: true,
});

export const SIGN_OUT: APIData = new APIData("auth/logout", APIMethod.POST);

export const GET_SESSION: APIData = new APIData(
  "auth/get-session",
  APIMethod.GET,
);

export const OTP_SEND: APIData = new APIData("auth/otp/send", APIMethod.POST, {
  public: true,
});

export const OTP_VERIFY: APIData = new APIData(
  "auth/otp/verify",
  APIMethod.POST,
  { public: true },
);

export const PROFILE_COMPLETE: APIData = new APIData(
  "auth/profile/complete",
  APIMethod.POST,
);

export const STORE_SELECT: APIData = new APIData(
  "auth/store/select",
  APIMethod.POST,
);
