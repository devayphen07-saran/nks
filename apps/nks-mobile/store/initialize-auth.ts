import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import {
  tokenManager,
  SESSION_STALE_MS,
  migrateUserToSecureStore,
} from "@nks/mobile-utils";
import { jwtDecode } from "jwt-decode";
import { offlineSession } from "../lib/auth/offline-session";
import { getServerAdjustedNow } from "../lib/utils/server-time";
import { setCredentials, logout } from "./auth-slice";
import { refreshSession } from "./refresh-session";
import { clearAuthState } from "./clear-auth-state";
import { sessionTokenReg } from "@nks/utils";
import { validateAuthResponse } from "../lib/auth/token-validators";
import { sanitizeError } from "../lib/utils/log-sanitizer";
import { JWTManager } from "../lib/auth/jwt-manager";
import { initializeRateLimiters } from "../lib/utils/rate-limiter";
import { initializeDatabase } from "../lib/database/connection";
import { initializeSyncEngine } from "../lib/sync/sync-engine";
import { registerProactiveRefresh } from "../lib/auth/jwt-refresh";
import { createLogger } from "../lib/utils/logger";
import type { AppDispatch } from "./index";

const log = createLogger("Auth:init");

export const initializeAuth = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/bootstrap", async (_, { dispatch }) => {
  try {
    log.info("Starting session initialization...");

    // Initialize local SQLite database (idempotent — safe to call every startup)
    await initializeDatabase();

    // Restore persisted lastSyncedAt and reset any 'in_progress' mutations
    // left over from a previous session that crashed mid-push.
    await initializeSyncEngine();

    // One-time migration: move user PII from unencrypted AsyncStorage → SecureStore
    await migrateUserToSecureStore();

    // Hydrate JWTManager (access + offline + refresh tokens) into memory
    await JWTManager.hydrate();

    // Load persisted rate limiter state so lockouts survive app restarts
    await initializeRateLimiters();

    const envelope = await tokenManager.loadSession<AuthResponse>();

    if (!envelope?.data) {
      log.info("No stored session found");
      dispatch(logout());
      return;
    }

    log.info("Validating stored session structure...");
    const validation = validateAuthResponse(envelope.data);

    if (!validation.isValid) {
      log.error("Stored session validation failed:", validation.errors);
      await clearAuthState(dispatch, logout);
      return;
    }

    log.info("Session validation passed");

    // Check that the refresh token has not expired (7-day TTL).
    // auth.expiresAt is the access-token TTL (15 min) and is overwritten on every
    // refresh — using it here would log the user out on every cold start >15 min
    // after the last proactive refresh. The session is only truly dead when the
    // refresh token expires; at that point we cannot re-issue any new credentials.
    const refreshExpiresAt = envelope.data.auth.refreshExpiresAt;
    if (refreshExpiresAt) {
      const expiryTime = new Date(refreshExpiresAt).getTime();
      const now = await getServerAdjustedNow();
      if (expiryTime < now) {
        log.warn("Refresh token has expired — session cannot be renewed", {
          refreshExpiresAt,
          now: new Date(now).toISOString(),
        });
        await clearAuthState(dispatch, logout);
        return;
      }
    }

    // Validate token format one more time
    const sessionToken = envelope.data.auth.sessionToken;
    if (!sessionToken || !sessionTokenReg.test(sessionToken)) {
      log.error("Session token missing or format invalid, clearing session");
      await clearAuthState(dispatch, logout);
      return;
    }

    tokenManager.set(sessionToken);
    log.info("In-memory token restored");

    dispatch(setCredentials(envelope.data));
    log.info("Credentials restored to Redux");

    // Register foreground refresh listener for returning users.
    // useOtpVerify calls this after a fresh login; here we cover the cold-start
    // path so returning users also get proactive access-token refresh on foreground.
    registerProactiveRefresh((authResponse) => dispatch(setCredentials(authResponse)));

    // Restore offline session for offline POS capability
    try {
      const session = await offlineSession.load();
      if (session) {
        if (offlineSession.isValid(session)) {
          const roleStatus = offlineSession.isRolesStale(session);
          const statusMsg = offlineSession.getStatus(session);

          log.info("OfflineSession restored", {
            userGuuid: session.userGuuid,
            storeGuuid: session.storeGuuid,
            expiresIn:
              Math.round((session.offlineValidUntil - Date.now()) / 60000) +
              "min",
            rolesStale: roleStatus.isStale,
            roleReason: roleStatus.reason,
            status: statusMsg.message,
          });

          if (roleStatus.isStale) {
            log.warn(
              `Roles may be outdated: ${roleStatus.reason}. ` +
                `User should sync online to verify current permissions.`,
            );
          }
        } else {
          log.warn("OfflineSession expired", {
            userGuuid: session.userGuuid,
            expiredAt: new Date(session.offlineValidUntil).toISOString(),
          });
        }
      } else {
        // Upgrade path: previous app versions never created an offline session at login.
        // Attempt to rebuild from the stored auth response so offline POS works immediately
        // without requiring the user to log out and back in.
        const offlineToken = envelope.data.offline?.token;
        const userGuuid = envelope.data.user?.guuid;
        if (offlineToken && userGuuid) {
          let roles: string[] = [];
          try {
            roles = jwtDecode<{ roles?: string[] }>(offlineToken).roles ?? [];
          } catch {
            /* empty roles accepted — will sync on next token refresh */
          }

          await offlineSession.create({
            userGuuid,
            storeGuuid: envelope.data.context?.defaultStoreGuuid ?? null,
            storeName: "",
            roles,
            offlineToken,
            signature: envelope.data.offline?.sessionSignature,
            deviceId: envelope.data.sync?.deviceId ?? undefined,
          });
          log.info(
            "OfflineSession rebuilt from stored auth response (upgrade path)",
          );
        }
      }
    } catch (error) {
      log.debug("Failed to restore offline session:", sanitizeError(error));
    }

    // Check if session is stale and needs refresh
    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    if (isStale) {
      log.info(
        "Session is stale, dispatching refresh (will happen in background)",
      );
      dispatch(refreshSession());
    }

    log.info("Initialization complete");
  } catch (e) {
    log.error("Initialization error:", sanitizeError(e));
    await clearAuthState(dispatch, logout);
  }
});
