import {
  LOGIN,
  REGISTER,
  SIGN_OUT,
  GET_SESSION,
  OTP_SEND,
  OTP_VERIFY,
  PROFILE_COMPLETE,
  STORE_SELECT,
  REFRESH_TOKEN,
  OTP_RETRY,
  SEND_EMAIL_OTP,
  VERIFY_EMAIL_OTP,
  SYNC_TIME,
  VERIFY_CLAIMS,
  CHECK_ACCOUNT_LOCK,
  ADMIN_UNLOCK_ACCOUNT,
  GET_JWKS,
} from "./api-data";
import {
  LoginRequest,
  RegisterRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  ProfileCompleteRequest,
  StoreSelectRequest,
} from "./request-dto";

export const login =
  LOGIN.generateAsyncThunk<LoginRequest>("auth/login");

export const register =
  REGISTER.generateAsyncThunk<RegisterRequest>("auth/register");

export const signOut = SIGN_OUT.generateAsyncThunk("auth/signOut");

export const getSession = GET_SESSION.generateAsyncThunk("auth/getSession");

export const sendOtp =
  OTP_SEND.generateAsyncThunk<SendOtpRequest>("auth/sendOtp");

export const verifyOtp =
  OTP_VERIFY.generateAsyncThunk<VerifyOtpRequest>("auth/verifyOtp");

export const profileComplete =
  PROFILE_COMPLETE.generateAsyncThunk<ProfileCompleteRequest>(
    "auth/profileComplete",
  );

export const storeSelect =
  STORE_SELECT.generateAsyncThunk<StoreSelectRequest>("auth/storeSelect");

// ✅ NEW: Missing critical auth endpoints

export const refreshToken = REFRESH_TOKEN.generateAsyncThunk<{
  refreshToken: string;
}>("auth/refreshToken");

export const otpRetry = OTP_RETRY.generateAsyncThunk("auth/otpRetry");

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
  jwtToken: string;
}>("auth/verifyClaims");

export const checkAccountLock = CHECK_ACCOUNT_LOCK.generateAsyncThunk(
  "auth/checkAccountLock"
);

export const adminUnlockAccount = ADMIN_UNLOCK_ACCOUNT.generateAsyncThunk(
  "auth/adminUnlockAccount"
);

export const getJwks = GET_JWKS.generateAsyncThunk("auth/getJwks");
