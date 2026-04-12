import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthResponse } from "@nks/api-manager";
import { APIState, defaultAPIState } from "@nks/shared-types";
import { initializeAuth } from "./initialize-auth";

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

// Selectors
export const selectAuthData = (state: AuthState) => state.authResponse;
export const selectUser = (state: AuthState) => state.authResponse?.user;
export const selectSession = (state: AuthState) => state.authResponse?.session;
export const selectAccess = (state: AuthState) => state.authResponse?.access;
