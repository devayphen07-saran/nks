import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { sessionTokenReg } from "@nks/utils";
import { fetchJwksPublicKey } from "../lib/jwks-cache";
import { offlineSession } from "../lib/offline-session";
import { syncServerTime } from "../lib/server-time";
import { setCredentials } from "./auth-slice";
import {
  validateAuthResponse,
  validateRefreshTokenFormat,
  analyzeStorageUsage,
} from "../lib/token-validators";
import { sanitizeError } from "../lib/log-sanitizer";
import type { AppDispatch } from "./index";

/**
 * Persist login session to SecureStore, in-memory, and Redux.
 * Validates input thoroughly before persistence.
 * On failure, clears all auth state to prevent partial login.
 *
 * SIMPLIFIED: Removed expensive read-back verification and field-by-field validation.
 * SecureStore is atomic — if write succeeds, data is intact.
 */
export async function persistLogin(
  authResponse: AuthResponse,
  dispatch: AppDispatch,
): Promise<void> {
  try {
    // ════════════════════════════════════════════════════════════════════════════
    // VALIDATION: Ensure input is valid before touching storage
    // ════════════════════════════════════════════════════════════════════════════

    // Validate full auth response structure
    const validation = validateAuthResponse(authResponse);
    if (!validation.isValid) {
      throw new Error(
        `Invalid auth response: ${validation.errors.join(", ")}`
      );
    }

    // Validate refresh token format (Issue 9.2)
    const refreshTokenCheck = validateRefreshTokenFormat(
      authResponse.session?.refreshToken
    );
    if (!refreshTokenCheck.isValid) {
      throw new Error(`Refresh token invalid: ${refreshTokenCheck.error}`);
    }

    // Analyze storage usage (Issue 1.1)
    const storageAnalysis = analyzeStorageUsage(authResponse);
    console.log(
      `[Auth] Session valid. Size: ${storageAnalysis.sizeBytes}b (${storageAnalysis.usagePercent}%)`
    );
    if (storageAnalysis.message) {
      console.warn(`[Auth] ${storageAnalysis.message}`);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PERSIST: Write to SecureStore (atomic operation)
    // ════════════════════════════════════════════════════════════════════════════
    console.log("[Auth] Persisting session to SecureStore...");
    await tokenManager.persistSession(authResponse);

    // ════════════════════════════════════════════════════════════════════════════
    // IN-MEMORY: Set the session token for immediate use
    // ════════════════════════════════════════════════════════════════════════════
    const sessionToken = authResponse.session.sessionToken;
    if (!sessionTokenReg.test(sessionToken)) {
      throw new Error(`Session token format invalid: length ${sessionToken.length}`);
    }
    tokenManager.set(sessionToken);
    console.log("[Auth] In-memory token set");

    // ════════════════════════════════════════════════════════════════════════════
    // NON-CRITICAL: Sync server time + create offline session in parallel
    // Neither blocks login — failures are logged and swallowed.
    // ════════════════════════════════════════════════════════════════════════════
    const activeStoreId = authResponse.access?.activeStoreId;

    const syncPromise = syncServerTime().then(() => {
      console.log("[Auth] Server time synced");
    }).catch((err) => {
      console.warn("[Auth] Server time sync failed (non-critical):", sanitizeError(err));
    });

    const offlinePromise = activeStoreId
      ? (async () => {
          const roles = authResponse.access?.roles ?? [];
          const activeStoreRole = roles.find((r) => r.storeId === activeStoreId);
          const storeName = activeStoreRole?.storeName ?? "Store";
          const roleCodes = roles.map((r) => r.roleCode);
          const jwksPublicKey = await fetchJwksPublicKey();
          await offlineSession.create({
            userId: parseInt(authResponse.user.id, 10) || 0,
            storeId: activeStoreId,
            storeName,
            roles: roleCodes,
            jwksPublicKey,
            offlineToken: authResponse.offlineToken ?? "",
          });
          console.log("[Auth] Offline session created");
        })().catch((err) => {
          console.warn("[Auth] Offline session failed (non-critical):", sanitizeError(err));
        })
      : Promise.resolve();

    await Promise.allSettled([syncPromise, offlinePromise]);

    // ════════════════════════════════════════════════════════════════════════════
    // STATE: Update Redux store
    // ════════════════════════════════════════════════════════════════════════════
    dispatch(setCredentials(authResponse));
    console.log("[Auth] Session persisted successfully");
  } catch (error) {
    // ════════════════════════════════════════════════════════════════════════════
    // CLEANUP: On any failure, clear all auth state
    // ════════════════════════════════════════════════════════════════════════════
    console.error("[Auth] Persistence failed, clearing all auth state:", sanitizeError(error));

    tokenManager.clear();
    await tokenManager.clearSession().catch(() => {});
    await offlineSession.clear().catch(() => {});
    dispatch(setCredentials(null as any));

    // Provide clear error to user
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to save session: ${message}. Please try logging in again.`
    );
  }
}
