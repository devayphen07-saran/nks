import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";
import { offlineSession } from "../lib/offline-session";
import { getServerAdjustedNow } from "../lib/server-time";
import { setCredentials, setUnauthenticated } from "./auth-slice";
import { refreshSession } from "./refresh-session";
import { clearAuthState } from "./clear-auth-state";
import { sessionTokenReg } from "@nks/utils";
import { validateAuthResponse } from "../lib/token-validators";
import { sanitizeError } from "../lib/log-sanitizer";
import { JWTManager } from "../lib/jwt-manager";
import { createLogger } from "../lib/logger";
import type { AppDispatch } from "./index";

const log = createLogger("Auth:init");

/**
 * CRITICAL FIX #2: Initialize auth with comprehensive validation.
 * Validates stored session structure before using tokens.
 */
export const initializeAuth = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/bootstrap", async (_, { dispatch }) => {
  try {
    log.info("Starting session initialization...");

    // Hydrate JWTManager (access + offline + refresh tokens) into memory
    await JWTManager.hydrate();

    const envelope = await tokenManager.loadSession<AuthResponse>();

    if (!envelope?.data) {
      log.info("No stored session found");
      dispatch(setUnauthenticated());
      return;
    }

    // ✅ CRITICAL FIX #2: Validate session structure BEFORE using tokens
    log.info("Validating stored session structure...");
    const validation = validateAuthResponse(envelope.data);

    if (!validation.isValid) {
      log.error("Stored session validation failed:", validation.errors);
      await clearAuthState(dispatch, setUnauthenticated);
      return;
    }

    log.info("Session validation passed");

    // Validate session has not expired before restoring (uses server-adjusted time)
    const sessionExpiresAt = envelope.data.session.expiresAt;
    if (sessionExpiresAt) {
      const expiryTime = new Date(sessionExpiresAt).getTime();
      const now = await getServerAdjustedNow();
      if (expiryTime < now) {
        log.warn("Stored session has expired", {
          expiresAt: sessionExpiresAt,
          now: new Date(now).toISOString(),
        });
        await clearAuthState(dispatch, setUnauthenticated);
        return;
      }
    }

    // Validate token format one more time
    const sessionToken = envelope.data.session.sessionToken;
    if (!sessionTokenReg.test(sessionToken)) {
      log.error("Session token format invalid, clearing session");
      await clearAuthState(dispatch, setUnauthenticated);
      return;
    }

    // ✅ CRITICAL FIX #2: Only NOW set in-memory token after all validation passes
    tokenManager.set(sessionToken);
    log.info("In-memory token restored");

    dispatch(setCredentials(envelope.data));
    log.info("Credentials restored to Redux");

    // Restore offline session for offline POS capability
    try {
      const session = await offlineSession.load();
      if (session) {
        if (offlineSession.isValid(session)) {
          // ✅ CRITICAL FIX #4.2: Check if roles are stale (Issue 4.2)
          const roleStatus = offlineSession.isRolesStale(session);
          const statusMsg = offlineSession.getStatus(session);

          log.info("OfflineSession restored", {
            userId: session.userId,
            storeId: session.storeId,
            expiresIn: Math.round((session.offlineValidUntil - Date.now()) / 60000) + "min",
            rolesStale: roleStatus.isStale,
            roleReason: roleStatus.reason,
            status: statusMsg.message,
          });

          // Warn if roles are stale
          if (roleStatus.isStale) {
            log.warn(
              `Roles may be outdated: ${roleStatus.reason}. ` +
              `User should sync online to verify current permissions.`
            );
          }
        } else {
          log.warn("OfflineSession expired", {
            userId: session.userId,
            expiredAt: new Date(session.offlineValidUntil).toISOString(),
          });
        }
      }
    } catch (error) {
      log.debug("Failed to restore offline session:", sanitizeError(error));
    }

    // Check if session is stale and needs refresh
    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    if (isStale) {
      log.info("Session is stale, dispatching refresh (will happen in background)");
      dispatch(refreshSession());
    }

    log.info("Initialization complete");
  } catch (e) {
    log.error("Initialization error:", sanitizeError(e));
    await clearAuthState(dispatch, setUnauthenticated);
  }
});
