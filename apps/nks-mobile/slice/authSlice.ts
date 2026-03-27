import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthResponse } from "@nks/api-manager";
import { APIState, defaultAPIState } from "@nks/shared-types";

export interface AuthState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  authResponse: AuthResponse | null;
  loginState: APIState;
}

const initialState: AuthState = {
  isInitializing: true,
  isAuthenticated: false,
  authResponse: null,
  loginState: { ...defaultAPIState },
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
      state.isAuthenticated = false;
      state.authResponse = null;
    },
    setUnauthenticated: (state) => {
      state.isInitializing = false;
      state.isAuthenticated = false;
      state.authResponse = null;
    },
  },
});

export const { setCredentials, logout, setUnauthenticated } = authSlice.actions;
export const authReducer = authSlice.reducer;

// Selectors for convenient access to nested data
export const selectAuthData = (state: AuthState) => state.authResponse?.data;
export const selectUser = (state: AuthState) => state.authResponse?.data?.user;
export const selectSession = (state: AuthState) => state.authResponse?.data?.session;
export const selectAccess = (state: AuthState) => state.authResponse?.data?.access;
export const selectAuthContext = (state: AuthState) => state.authResponse?.data?.authContext;
export const selectFeatureFlags = (state: AuthState) => state.authResponse?.data?.flags;
