import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthResponse, SystemRoleCodes } from "@nks/api-manager";
export interface AuthState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  authResponse: AuthResponse | null;
}

const initialState: AuthState = {
  isInitializing: true,
  isAuthenticated: false,
  authResponse: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthResponse>) => {
      state.isInitializing = false;
      state.isAuthenticated = true;
      state.authResponse = action.payload;
    },
    logout: (state) => {
      state.isInitializing = false;
      state.isAuthenticated = false;
      state.authResponse = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase("auth/bootstrap/pending", (state) => {
        state.isInitializing = true;
      })
      .addCase("auth/bootstrap/fulfilled", () => {
        // isInitializing is set to false by setCredentials or logout dispatched inside the thunk
      })
      .addCase("auth/bootstrap/rejected", (state) => {
        state.isInitializing = false;
        state.isAuthenticated = false;
        state.authResponse = null;
      });
  },
});

export const { setCredentials, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;

/**
 * Derived selector — true when the authenticated user has the SUPER_ADMIN role.
 *
 * Primary source: `auth.accessToken` JWT payload (roles are embedded at issuance
 * and kept fresh by the proactive refresh cycle).
 *
 * Fallback: if the access token is absent (edge case — old session format before
 * accessToken was added to the response schema) we return false safely rather
 * than throwing, which would prevent the app from rendering.
 */
export const selectIsSuperAdmin = (state: { auth: AuthState }): boolean => {
  const accessToken = state.auth.authResponse?.auth?.accessToken;

  if (accessToken) {
    try {
      // JWT uses URL-safe Base64 (- → +, _ → /) — atob() needs standard Base64
      const raw = accessToken.split(".")[1];
      const payload = JSON.parse(
        atob(raw.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { roles?: string[] };
      return payload.roles?.includes(SystemRoleCodes.SUPER_ADMIN) ?? false;
    } catch {
      // malformed JWT — fall through to false
    }
  }

  return false;
};
