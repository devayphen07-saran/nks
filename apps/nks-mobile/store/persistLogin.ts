import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { fetchJwksPublicKey } from "../lib/jwks-cache";
import { offlineSession } from "../lib/offline-session";
import { setCredentials } from "./authSlice";
import type { AppDispatch } from "./index";

/** Called after a successful login or register to persist the session. */
export async function persistLogin(
  authResponse: AuthResponse,
  dispatch: AppDispatch,
): Promise<void> {
  tokenManager.set(authResponse.data.session.sessionToken);

  try {
    await tokenManager.persistSession(authResponse);
  } catch (error) {
    // Storage write failed (full, permission denied, etc.).
    // Token is still alive in memory for this session — user can continue,
    // but will be logged out on next app restart.
  }

  // Create offline session for offline POS operations
  try {
    const user = authResponse.data.user;
    const access = authResponse.data.access;
    const roles = access?.roles ?? [];

    // Get active store ID and name from access response
    const activeStoreId = access?.activeStoreId;
    if (!activeStoreId) {
      console.warn("[Auth] No active store ID in auth response — skipping offline session");
      dispatch(setCredentials(authResponse));
      return;
    }

    // Find the primary role for the active store to get storeName
    const activeStoreRole = roles.find((r) => r.storeId === activeStoreId);
    const storeName = activeStoreRole?.storeName ?? "Store";

    // Extract role codes from the roles array
    const roleCodes = roles.map((r) => r.roleCode);

    // Fetch JWKS public key for offline JWT verification
    const jwksPublicKey = await fetchJwksPublicKey();

    // Create offline session (valid for 7 days)
    // Use guuid as userId (it's the unique global user ID)
    await offlineSession.create({
      userId: parseInt(user.id, 10) || 0, // Convert string to number, fallback to 0
      storeId: activeStoreId,
      storeName,
      roles: roleCodes,
      jwksPublicKey,
    });

    console.log("[Auth] OfflineSession created for offline POS", {
      userId: user.id,
      storeId: activeStoreId,
      storeName,
    });
  } catch (error) {
    // OfflineSession creation failed (network, storage, etc.)
    // This is not critical — app will still work online
    console.warn("[Auth] Failed to create OfflineSession:", error);
  }

  dispatch(setCredentials(authResponse));
}
