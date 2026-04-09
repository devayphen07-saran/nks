import { APIData, APIMethod } from "../api-handler";

// ─── Auth Endpoints ────────────────────────────────────────────────────────
// All endpoints follow REST conventions and include proper security guards

// 1. Login with email + password
export const LOGIN: APIData = new APIData("auth/login", APIMethod.POST, {
  public: true,
});

// 2. Register new user
export const REGISTER: APIData = new APIData("auth/register", APIMethod.POST, {
  public: true,
});

// 3. Refresh access token using refresh token
export const REFRESH_TOKEN: APIData = new APIData(
  "auth/refresh-token",
  APIMethod.POST,
  { public: true }
);

// 4. Logout (invalidate session)
export const SIGN_OUT: APIData = new APIData("auth/logout", APIMethod.POST);

// 5. Get JWKS public key set
export const GET_JWKS: APIData = new APIData(
  "auth/.well-known/jwks.json",
  APIMethod.GET,
  { public: true }
);

// 6. Sync device time with server
export const SYNC_TIME: APIData = new APIData(
  "auth/sync-time",
  APIMethod.POST,
  { public: true }
);

// 7. Verify JWT token claims
export const VERIFY_CLAIMS: APIData = new APIData(
  "auth/token/verify",
  APIMethod.POST
);

// 8. Get current authenticated user (validates session, returns user + roles)
export const GET_ME: APIData = new APIData("auth/me", APIMethod.GET);

// ─── OTP Endpoints ────────────────────────────────────────────────────────

// 8. Send OTP via SMS (MSG91)
export const OTP_SEND: APIData = new APIData("auth/otp/send", APIMethod.POST, {
  public: true,
});

// 9. Verify OTP and login
export const OTP_VERIFY: APIData = new APIData(
  "auth/otp/verify",
  APIMethod.POST,
  { public: true }
);

// 10. Resend OTP using request ID
export const OTP_RESEND: APIData = new APIData(
  "auth/otp/resend",
  APIMethod.POST,
  { public: true }
);

// 11. Send OTP to email (authenticated user during onboarding)
export const SEND_EMAIL_OTP: APIData = new APIData(
  "auth/otp/email/send",
  APIMethod.POST
);

// 12. Verify email OTP and mark email as verified
export const VERIFY_EMAIL_OTP: APIData = new APIData(
  "auth/otp/email/verify",
  APIMethod.POST
);

// ─── Permissions Endpoints ────────────────────────────────────────────────

// 13. Get full permissions snapshot (for offline-first mobile)
export const GET_PERMISSIONS_SNAPSHOT: APIData = new APIData(
  "auth/permissions-snapshot",
  APIMethod.GET
);

// 14. Get permissions delta since version
export const GET_PERMISSIONS_DELTA: APIData = new APIData(
  "auth/permissions-delta",
  APIMethod.GET
);

// ─── Session Management Endpoints ────────────────────────────────────────

// 15. List user device sessions
export const GET_SESSIONS: APIData = new APIData("auth/sessions", APIMethod.GET);

// 16. Terminate a specific session
export const DELETE_SESSION: APIData = new APIData(
  "auth/sessions/:sessionId",
  APIMethod.DELETE
);

// 17. Terminate all sessions
export const DELETE_ALL_SESSIONS: APIData = new APIData(
  "auth/sessions",
  APIMethod.DELETE
);

