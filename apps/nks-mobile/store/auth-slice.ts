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

/**
 * Derived selector — true when the authenticated user has the SUPER_ADMIN role.
 * Decoded from the jwtToken claims (roles are embedded at login time).
 */
export const selectIsSuperAdmin = (state: { auth: AuthState }): boolean => {
  const jwtToken = state.auth.authResponse?.session?.jwtToken;
  if (!jwtToken) return false;
  try {
    // JWT uses URL-safe Base64 (- → +, _ → /) — atob() needs standard Base64
    const raw = jwtToken.split('.')[1];
    const payload = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as { roles?: string[] };
    return payload.roles?.includes('SUPER_ADMIN') ?? false;
  } catch {
    return false;
  }
};

