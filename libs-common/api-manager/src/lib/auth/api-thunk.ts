import {
  LOGIN,
  REGISTER,
  SIGN_OUT,
  GET_SESSION,
  OTP_SEND,
  OTP_VERIFY,
  PROFILE_COMPLETE,
  STORE_SELECT,
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
