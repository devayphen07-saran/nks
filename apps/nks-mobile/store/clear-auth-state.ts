import { tokenManager } from "@nks/mobile-utils";
import { offlineSession } from '../lib/auth/offline-session';
import { JWTManager } from '../lib/auth/jwt-manager';
import type { AppDispatch } from "./index";

/**
 * Clears all authentication state — tokens, SecureStore, and Redux.
 *
 * Used by error paths in initialize-auth, persist-login, and refresh-session.
 * Does NOT clear DeviceManager or OTP rate limiters — use logoutThunk for full logout.
 */
export async function clearAuthState(
  dispatch: AppDispatch,
  action: () => { type: string },
): Promise<void> {
  tokenManager.clear();
  await Promise.allSettled([
    tokenManager.clearSession(),
    offlineSession.clear(),
    JWTManager.clear(),
  ]);
  dispatch(action());
}
