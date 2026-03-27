import { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { setCredentials } from "../slice/authSlice";
import type { AppDispatch } from "./index";

/** Called after a successful login or register to persist the session. */
export async function persistLogin(
  authResponse: AuthResponse,
  dispatch: AppDispatch,
): Promise<void> {
  tokenManager.set(authResponse.data.session.accessToken);

  try {
    await tokenManager.persistSession(authResponse);
    console.log('[Auth:persistLogin] ✅ session persisted to storage');
  } catch (error) {
    // Storage write failed (full, permission denied, etc.).
    // Token is still alive in memory for this session — user can continue,
    // but will be logged out on next app restart.
    console.warn('[Auth] Failed to persist session to storage:', error);
  }

  dispatch(setCredentials(authResponse));
}
