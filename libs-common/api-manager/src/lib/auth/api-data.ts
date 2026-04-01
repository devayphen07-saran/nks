import { APIData, APIMethod } from "../api-handler";

export const LOGIN: APIData = new APIData("auth/login", APIMethod.POST, {
  public: true,
});

export const REGISTER: APIData = new APIData("auth/register", APIMethod.POST, {
  public: true,
});

export const SIGN_OUT: APIData = new APIData("auth/logout", APIMethod.POST);

export const GET_SESSION: APIData = new APIData(
  "routes/me",
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

// ✅ NEW: Missing critical auth endpoints

export const REFRESH_TOKEN: APIData = new APIData(
  "auth/refresh-token",
  APIMethod.POST,
  { public: true }
);

export const OTP_RETRY: APIData = new APIData(
  "auth/otp/retry",
  APIMethod.POST,
  { public: true }
);

export const SEND_EMAIL_OTP: APIData = new APIData(
  "auth/otp/email/send",
  APIMethod.POST,
);

export const VERIFY_EMAIL_OTP: APIData = new APIData(
  "auth/otp/email/verify",
  APIMethod.POST,
);

export const SYNC_TIME: APIData = new APIData(
  "auth/sync-time",
  APIMethod.POST,
  { public: true }
);

export const VERIFY_CLAIMS: APIData = new APIData(
  "auth/verify-claims",
  APIMethod.POST,
);

export const CHECK_ACCOUNT_LOCK: APIData = new APIData(
  "auth/lock-status/:userId",
  APIMethod.POST,
);

export const ADMIN_UNLOCK_ACCOUNT: APIData = new APIData(
  "auth/admin/unlock/:userId",
  APIMethod.POST,
);

export const GET_JWKS: APIData = new APIData(
  "auth/.well-known/jwks.json",
  APIMethod.GET,
  { public: true }
);
