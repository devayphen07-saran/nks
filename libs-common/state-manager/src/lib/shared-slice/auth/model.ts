import { AuthResponse } from "@nks/api-manager";
import type { APIState } from "@nks/shared-types";

export type AuthStatus =
  | "INITIALIZING"
  | "UNAUTHENTICATED"
  | "AUTHENTICATED"
  | "LOCKED";

export interface AuthState {
  status: AuthStatus;
  user: AuthResponse | null;
  error: string | null;
  /** Timestamp (Date.now()) of the last successful session fetch from the API. */
  fetchedAt: number;

  // Email + Password Login state
  loginState: APIState;

  // User Registration state
  registerState: APIState;

  // OTP Login flow states
  sendOtpState: APIState;
  verifyOtpState: APIState;

  // Profile completion states
  profileCompleteState: APIState;

  // Store selection state
  storeSelectState: APIState;
}
