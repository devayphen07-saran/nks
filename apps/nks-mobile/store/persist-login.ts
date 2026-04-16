import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { sessionTokenReg } from "@nks/utils";
import { offlineSession } from "../lib/offline-session";
import { syncServerTime } from "../lib/server-time";
import { setCredentials, logout } from "./auth-slice";
import { clearAuthState } from "./clear-auth-state";
import {
  validateAuthResponse,
  validateRefreshTokenFormat,
  analyzeStorageUsage,
} from "../lib/token-validators";
import { sanitizeError } from "../lib/log-sanitizer";
import { getStableDeviceId } from "../lib/device-binding";
import { JWTManager } from "../lib/jwt-manager";
import { createLogger } from "../lib/logger";
import type { AppDispatch } from "./index";

const log = createLogger("Auth");

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
    log.info(`Session valid. Size: ${storageAnalysis.sizeBytes}b (${storageAnalysis.usagePercent}%)`);
    if (storageAnalysis.message) {
      log.warn(storageAnalysis.message);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PERSIST: Write to SecureStore (atomic operation)
    // ════════════════════════════════════════════════════════════════════════════
    log.info("Persisting session to SecureStore...");
    await tokenManager.persistSession(authResponse);

    // ════════════════════════════════════════════════════════════════════════════
    // IN-MEMORY: Set the session token for immediate use
    // ════════════════════════════════════════════════════════════════════════════
    const sessionToken = authResponse.session.sessionToken;
    if (!sessionTokenReg.test(sessionToken)) {
      throw new Error(`Session token format invalid: length ${sessionToken.length}`);
    }
    tokenManager.set(sessionToken);
    log.info("In-memory token set");

    // ════════════════════════════════════════════════════════════════════════════
    // NON-CRITICAL: Sync server time + create offline session in parallel
    // Neither blocks login — failures are logged and swallowed.
    // ════════════════════════════════════════════════════════════════════════════
    const activeStoreId = authResponse.access?.activeStoreId;

    // Persist dual tokens (accessToken, offlineToken, refreshToken) into JWTManager
    const jwtPersistPromise = (async () => {
      const accessToken = authResponse.session?.jwtToken;
      const offlineToken = authResponse.offlineToken;
      const refreshToken = authResponse.session?.refreshToken;
      if (accessToken && offlineToken && refreshToken) {
        await JWTManager.persistTokens({ accessToken, offlineToken, refreshToken });
        log.info("JWTManager tokens persisted");
      }
    })().catch((err) => {
      log.warn("JWTManager persist failed (non-critical):", sanitizeError(err));
    });

    const syncPromise = syncServerTime().then(() => {
      log.info("Server time synced");
    }).catch((err) => {
      log.warn("Server time sync failed (non-critical):", sanitizeError(err));
    });

    const offlinePromise = activeStoreId
      ? (async () => {
          const roles = authResponse.access?.roles ?? [];
          const activeStoreRole = roles.find((r) => r.storeId === activeStoreId);
          const storeName = activeStoreRole?.storeName ?? "Store";
          const roleCodes = roles.map((r) => r.roleCode);
          const deviceId = await getStableDeviceId().catch(() => undefined);
          await offlineSession.create({
            userId: parseInt(authResponse.user.id, 10) || 0,
            storeId: activeStoreId,
            storeName,
            roles: roleCodes,
            offlineToken: authResponse.offlineToken ?? "",
            signature: authResponse.offlineSessionSignature,
            deviceId,
          });
          log.info("Offline session created");
        })().catch((err) => {
          log.warn("Offline session failed (non-critical):", sanitizeError(err));
        })
      : Promise.resolve();

    await Promise.allSettled([jwtPersistPromise, syncPromise, offlinePromise]);

    // ════════════════════════════════════════════════════════════════════════════
    // STATE: Update Redux store
    // ════════════════════════════════════════════════════════════════════════════
    dispatch(setCredentials(authResponse));
    log.info("Session persisted successfully");
  } catch (error) {
    // ════════════════════════════════════════════════════════════════════════════
    // CLEANUP: On any failure, clear all auth state
    // ════════════════════════════════════════════════════════════════════════════
    log.error("Persistence failed, clearing all auth state:", sanitizeError(error));
    await clearAuthState(dispatch, logout);

    // Provide clear error to user
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to save session: ${message}. Please try logging in again.`
    );
  }
}
