import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { sessionTokenReg } from "@nks/utils";
import { syncServerTime } from '../lib/utils/server-time';
import { setCredentials, logout } from "./auth-slice";
import { clearAuthState } from "./clear-auth-state";
import {
  validateAuthResponse,
  validateRefreshTokenFormat,
  analyzeStorageUsage,
} from '../lib/auth/token-validators';
import { sanitizeError } from '../lib/utils/log-sanitizer';
import { JWTManager } from '../lib/auth/jwt-manager';
import { createOfflineSessionFromAuth } from '../lib/auth/offline-session';
import { seedSyncStateFromAuth } from '../lib/sync/sync-engine';
import { initializeStoresAfterLogin } from '../lib/store/initialize-stores';
import { createLogger } from '../lib/utils/logger';
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
      throw new Error(`Invalid auth response: ${validation.errors.join(", ")}`);
    }

    const refreshTokenCheck = validateRefreshTokenFormat(
      authResponse.auth?.refreshToken,
    );
    if (!refreshTokenCheck.isValid) {
      throw new Error(`Refresh token invalid: ${refreshTokenCheck.error}`);
    }

    const storageAnalysis = analyzeStorageUsage(authResponse);
    log.info(
      `Session valid. Size: ${storageAnalysis.sizeBytes}b (${storageAnalysis.usagePercent}%)`,
    );
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
    const bearerToken = authResponse.auth.bearerToken;
    if (!bearerToken || !sessionTokenReg.test(bearerToken)) {
      throw new Error(
        `Bearer token missing or format invalid: length ${bearerToken?.length ?? 0}`,
      );
    }
    tokenManager.set(bearerToken, authResponse.auth.sessionId);
    log.info("In-memory token set");

    // ════════════════════════════════════════════════════════════════════════════
    // NON-CRITICAL: Sync server time + create offline session in parallel
    // Neither blocks login — failures are logged and swallowed.
    // ════════════════════════════════════════════════════════════════════════════
    // Persist offline + refresh tokens into JWTManager
    const jwtPersistPromise = (async () => {
      const offlineToken = authResponse.offline?.token;
      const refreshToken = authResponse.auth?.refreshToken;
      if (offlineToken && refreshToken) {
        await JWTManager.persistTokens({
          offlineToken,
          refreshToken,
        });
        log.info("JWTManager tokens persisted");
      }
    })().catch((err) => {
      log.warn("JWTManager persist failed (non-critical):", sanitizeError(err));
    });

    const syncPromise = syncServerTime()
      .then(() => log.info("Server time synced"))
      .catch((err) => log.warn("Server time sync failed (non-critical):", sanitizeError(err)));

    const offlineSessionPromise = createOfflineSessionFromAuth(authResponse)
      .then((session) => {
        if (session) log.info("Offline session created");
      })
      .catch((err) => log.warn("Offline session create failed (non-critical):", sanitizeError(err)));

    const syncSeedPromise = seedSyncStateFromAuth(null)
      .catch((err) => log.warn("Sync state seed failed (non-critical):", sanitizeError(err)));

    const storeBootstrapPromise = initializeStoresAfterLogin(authResponse)
      .catch((err) => log.warn("Store bootstrap failed (non-critical):", sanitizeError(err)));

    await Promise.allSettled([
      jwtPersistPromise,
      syncPromise,
      offlineSessionPromise,
      syncSeedPromise,
      storeBootstrapPromise,
    ]);

    // ════════════════════════════════════════════════════════════════════════════
    // STATE: Update Redux store
    // ════════════════════════════════════════════════════════════════════════════
    dispatch(setCredentials(authResponse));
    log.info("Session persisted successfully");
  } catch (error) {
    // ════════════════════════════════════════════════════════════════════════════
    // CLEANUP: On any failure, clear all auth state
    // ════════════════════════════════════════════════════════════════════════════
    log.error(
      "Persistence failed, clearing all auth state:",
      sanitizeError(error),
    );
    await clearAuthState(dispatch, logout);

    // Provide clear error to user
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to save session: ${message}. Please try logging in again.`,
    );
  }
}
