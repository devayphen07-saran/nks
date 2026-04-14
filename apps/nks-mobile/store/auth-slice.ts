import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthResponse } from "@nks/api-manager";
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
      .addCase("auth/bootstrap/pending", (state) => {
        state.isInitializing = true;
      })
      .addCase("auth/bootstrap/fulfilled", () => {
        // isInitializing is set to false by setCredentials or setUnauthenticated
        // dispatched inside the thunk
      })
      .addCase("auth/bootstrap/rejected", (state) => {
        state.isInitializing = false;
        state.isAuthenticated = false;
        state.authResponse = null;
      });
  },
});

export const { setCredentials, logout, setUnauthenticated } = authSlice.actions;
export const authReducer = authSlice.reducer;

