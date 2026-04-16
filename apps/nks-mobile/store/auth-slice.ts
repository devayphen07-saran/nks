import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthResponse } from "@nks/api-manager";
import { initializeAuth } from "./initialize-auth";
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
    setUnauthenticated: (state) => {
      state.isInitializing = false;
      state.isAuthenticated = false;
      state.authResponse = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(initializeAuth.fulfilled, () => {
        // isInitializing is set to false by setCredentials or setUnauthenticated
        // dispatched inside the thunk
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isInitializing = false;
        state.isAuthenticated = false;
        state.authResponse = null;
      });
  },
});

export const { setCredentials, logout, setUnauthenticated } = authSlice.actions;
export const authReducer = authSlice.reducer;

/**
 * Derived selector — true when the authenticated user has the SUPER_ADMIN role.
 * Computed from roles rather than stored as redundant state.
 */
export const selectIsSuperAdmin = (state: { auth: AuthState }): boolean =>
  state.auth.authResponse?.access?.roles?.some(
    (r) => r.roleCode === "SUPER_ADMIN",
  ) ?? false;

