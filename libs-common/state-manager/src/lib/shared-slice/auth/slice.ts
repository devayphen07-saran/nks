import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthData, login, register, sendOtp, verifyOtp, signOut, getMe } from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { AuthState } from "./model";

const initialState: AuthState = {
  status: "INITIALIZING",
  user: null,
  error: null,
  fetchedAt: 0,
  loginState: { ...defaultAPIState },
  registerState: { ...defaultAPIState },
  sendOtpState: { ...defaultAPIState },
  verifyOtpState: { ...defaultAPIState },
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Called after a successful login or session restore. */
    setAuthenticated(state, action: PayloadAction<AuthData>) {
      state.status = "AUTHENTICATED";
      state.user = action.payload;
      state.error = null;
      state.fetchedAt = Date.now();
    },
    /** Called on sign-out or when no stored session is found on startup. */
    setUnauthenticated(state) {
      state.status = "UNAUTHENTICATED";
      state.user = null;
      state.error = null;
      state.fetchedAt = 0;
    },
    /** Called when the account is locked (e.g. too many failed attempts). */
    setLocked(state) {
      state.status = "LOCKED";
    },
    /** Store a non-fatal error message (e.g. to display in UI). */
    setAuthError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    /* Login with Email + Password */
    builder.addCase(login.pending, (state) => {
      state.loginState.isLoading = true;
      state.loginState.hasError = false;
      state.loginState.errors = undefined;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loginState.isLoading = false;
      const data = action.payload?.data?.data as AuthData | undefined;
      state.user = data || null;
      state.status = data ? "AUTHENTICATED" : "UNAUTHENTICATED";
      state.loginState.response = data;
      state.error = null;
      state.fetchedAt = Date.now();
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loginState.isLoading = false;
      state.loginState.hasError = true;
      state.loginState.errors = action.payload;
      state.status = "UNAUTHENTICATED";
      state.error = action.error.message ?? "Login failed";
    });

    /* User Registration */
    builder.addCase(register.pending, (state) => {
      state.registerState.isLoading = true;
      state.registerState.hasError = false;
      state.registerState.errors = undefined;
    });
    builder.addCase(register.fulfilled, (state, action) => {
      state.registerState.isLoading = false;
      const data = action.payload?.data?.data as AuthData | undefined;
      state.user = data || null;
      state.status = data ? "AUTHENTICATED" : "UNAUTHENTICATED";
      state.registerState.response = data;
      state.error = null;
      state.fetchedAt = Date.now();
    });
    builder.addCase(register.rejected, (state, action) => {
      state.registerState.isLoading = false;
      state.registerState.hasError = true;
      state.registerState.errors = action.payload;
      state.status = "UNAUTHENTICATED";
      state.error = action.error.message ?? "Registration failed";
    });

    /* Send OTP */
    builder.addCase(sendOtp.pending, (state) => {
      state.sendOtpState.isLoading = true;
      state.sendOtpState.hasError = false;
      state.sendOtpState.errors = undefined;
    });
    builder.addCase(sendOtp.fulfilled, (state, action) => {
      state.sendOtpState.isLoading = false;
      state.sendOtpState.response = action.payload?.data;
    });
    builder.addCase(sendOtp.rejected, (state, action) => {
      state.sendOtpState.isLoading = false;
      state.sendOtpState.hasError = true;
      state.sendOtpState.errors = action.payload;
    });

    /* Verify OTP */
    builder.addCase(verifyOtp.pending, (state) => {
      state.verifyOtpState.isLoading = true;
      state.verifyOtpState.hasError = false;
      state.verifyOtpState.errors = undefined;
    });
    builder.addCase(verifyOtp.fulfilled, (state, action) => {
      state.verifyOtpState.isLoading = false;
      const data = action.payload?.data?.data as AuthData | undefined;
      state.user = data || null;
      state.status = data ? "AUTHENTICATED" : "UNAUTHENTICATED";
      state.verifyOtpState.response = data;
      state.error = null;
      state.fetchedAt = Date.now();
    });
    builder.addCase(verifyOtp.rejected, (state, action) => {
      state.verifyOtpState.isLoading = false;
      state.verifyOtpState.hasError = true;
      state.verifyOtpState.errors = action.payload;
      state.status = "UNAUTHENTICATED";
      state.error = action.error.message ?? "OTP Verification failed";
    });

    /* Get Me — refresh user data after session restore */
    builder.addCase(getMe.fulfilled, (state, action) => {
      const me = action.payload?.data as Record<string, unknown> | undefined;
      if (state.user && me) {
        state.user.user.firstName = (me.firstName as string | null) ?? state.user.user.firstName;
        state.user.user.lastName = (me.lastName as string | null) ?? state.user.user.lastName;
        state.user.user.email = (me.email as string) ?? state.user.user.email;
        state.user.user.phoneNumber = (me.phoneNumber as string | null) ?? state.user.user.phoneNumber;
        // roles are no longer in AuthResponse.access — fetched separately via store API
        if (me.guuid) state.user.user.guuid = me.guuid as string;
      }
      state.status = "AUTHENTICATED";
      state.fetchedAt = Date.now();
    });
    builder.addCase(getMe.rejected, (state) => {
      state.status = "UNAUTHENTICATED";
      state.user = null;
      state.fetchedAt = 0;
    });

    /* Sign Out — clear auth state regardless of API result */
    builder.addCase(signOut.fulfilled, (state) => {
      state.status = "UNAUTHENTICATED";
      state.user = null;
      state.error = null;
      state.fetchedAt = 0;
    });
    builder.addCase(signOut.rejected, (state) => {
      state.status = "UNAUTHENTICATED";
      state.user = null;
      state.error = null;
      state.fetchedAt = 0;
    });
  },
});

export const {
  setAuthenticated,
  setUnauthenticated,
  setLocked,
  setAuthError,
} = authSlice.actions;

export default authSlice.reducer;
