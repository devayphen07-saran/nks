import {
  LOGIN,
  REGISTER,
  SIGN_OUT,
  GET_ME,
  OTP_SEND,
  OTP_VERIFY,
  OTP_RESEND,
  REFRESH_TOKEN,
  SEND_EMAIL_OTP,
  VERIFY_EMAIL_OTP,
  SYNC_TIME,
  VERIFY_CLAIMS,
  GET_JWKS,
  GET_PERMISSIONS_SNAPSHOT,
  GET_PERMISSIONS_DELTA,
  GET_SESSIONS,
  DELETE_SESSION,
  DELETE_ALL_SESSIONS,
} from "./api-data";
import {
  LoginRequest,
  RegisterRequest,
  SendOtpRequest,
  VerifyOtpRequest,
} from "./request-dto";

export const login =
  LOGIN.generateAsyncThunk<LoginRequest>("auth/login");

export const register =
  REGISTER.generateAsyncThunk<RegisterRequest>("auth/register");

export const signOut = SIGN_OUT.generateAsyncThunk("auth/signOut");

export const sendOtp =
  OTP_SEND.generateAsyncThunk<SendOtpRequest>("auth/sendOtp");

export const verifyOtp =
  OTP_VERIFY.generateAsyncThunk<VerifyOtpRequest>("auth/verifyOtp");

export const otpResend = OTP_RESEND.generateAsyncThunk<{
  reqId: string;
}>("auth/otpResend");

export const refreshToken = REFRESH_TOKEN.generateAsyncThunk<{
  refreshToken: string;
}>("auth/refreshToken");

export const sendEmailOtp = SEND_EMAIL_OTP.generateAsyncThunk<{
  email: string;
}>("auth/sendEmailOtp");

export const verifyEmailOtp = VERIFY_EMAIL_OTP.generateAsyncThunk<{
  otp: string;
}>("auth/verifyEmailOtp");

export const syncTime = SYNC_TIME.generateAsyncThunk<{
  deviceTime: number;
}>("auth/syncTime");

export const verifyClaims = VERIFY_CLAIMS.generateAsyncThunk<{
  token: string;
}>("auth/verifyClaims");

export const getJwks = GET_JWKS.generateAsyncThunk("auth/getJwks");

export const getMe = GET_ME.generateAsyncThunk("auth/getMe");

// ─── Permissions ──────────────────────────────────────────────────────────

export const getPermissionsSnapshot =
  GET_PERMISSIONS_SNAPSHOT.generateAsyncThunk("auth/getPermissionsSnapshot");

export const getPermissionsDelta = GET_PERMISSIONS_DELTA.generateAsyncThunk<{
  sinceVersion?: string;
}>("auth/getPermissionsDelta");

// ─── Sessions ─────────────────────────────────────────────────────────────

export const getSessions = GET_SESSIONS.generateAsyncThunk("auth/getSessions");

export const deleteSession = DELETE_SESSION.generateAsyncThunk<{
  sessionId: string;
}>("auth/deleteSession");

export const deleteAllSessions = DELETE_ALL_SESSIONS.generateAsyncThunk(
  "auth/deleteAllSessions"
);
