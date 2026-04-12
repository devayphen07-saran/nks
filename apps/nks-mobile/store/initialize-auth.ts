import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";
import { offlineSession } from "../lib/offline-session";
import { getServerAdjustedNow } from "../lib/server-time";
import { setCredentials, setUnauthenticated } from "./auth-slice";
import { refreshSession } from "./refresh-session";
import { sessionTokenReg } from "@nks/utils";
import { validateAuthResponse } from "../lib/token-validators";
import { sanitizeError } from "../lib/log-sanitizer";
import { JWTManager } from "../lib/jwt-manager";
import type { AppDispatch } from "./index";

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
    console.log("[Auth:init] Starting session initialization...");

    // Hydrate JWTManager (access + offline + refresh tokens) into memory
    await JWTManager.hydrate();

    const envelope = await tokenManager.loadSession<AuthResponse>();

    if (!envelope?.data) {
      console.log("[Auth:init] No stored session found");
      dispatch(setUnauthenticated());
      return;
    }

    // ✅ CRITICAL FIX #2: Validate session structure BEFORE using tokens
    console.log("[Auth:init] Validating stored session structure...");
    const validation = validateAuthResponse(envelope.data);

    if (!validation.isValid) {
      console.error("[Auth:init] Stored session validation failed:", validation.errors);
      await tokenManager.clearSession();
      await offlineSession.clear().catch(() => {});
      dispatch(setUnauthenticated());
      return;
    }

    console.log("[Auth:init] Session validation passed");

    // Validate session has not expired before restoring (uses server-adjusted time)
    const sessionExpiresAt = envelope.data.session.expiresAt;
    if (sessionExpiresAt) {
      const expiryTime = new Date(sessionExpiresAt).getTime();
      const now = await getServerAdjustedNow();
      if (expiryTime < now) {
        console.warn("[Auth:init] Stored session has expired", {
          expiresAt: sessionExpiresAt,
          now: new Date(now).toISOString(),
        });
        await tokenManager.clearSession();
        dispatch(setUnauthenticated());
        return;
      }
    }

    // Validate token format one more time
    const sessionToken = envelope.data.session.sessionToken;
    if (!sessionTokenReg.test(sessionToken)) {
      console.error(
        "[Auth:init] Session token format invalid, clearing session"
      );
      await tokenManager.clearSession();
      dispatch(setUnauthenticated());
      return;
    }

    // ✅ CRITICAL FIX #2: Only NOW set in-memory token after all validation passes
    tokenManager.set(sessionToken);
    console.log("[Auth:init] In-memory token restored");

    dispatch(setCredentials(envelope.data));
    console.log("[Auth:init] Credentials restored to Redux");

    // Restore offline session for offline POS capability
    try {
      const session = await offlineSession.load();
      if (session) {
        if (offlineSession.isValid(session)) {
          // ✅ CRITICAL FIX #4.2: Check if roles are stale (Issue 4.2)
          const roleStatus = offlineSession.isRolesStale(session);
          const statusMsg = offlineSession.getStatus(session);

          console.log(
            "[Auth:init] OfflineSession restored",
            {
              userId: session.userId,
              storeId: session.storeId,
              expiresIn: Math.round((session.offlineValidUntil - Date.now()) / 60000) + "min",
              rolesStale: roleStatus.isStale,
              roleReason: roleStatus.reason,
              status: statusMsg.message,
            }
          );

          // Warn if roles are stale
          if (roleStatus.isStale) {
            console.warn(
              `[Auth:init] Roles may be outdated: ${roleStatus.reason}. ` +
              `User should sync online to verify current permissions.`
            );
          }
        } else {
          console.warn("[Auth:init] OfflineSession expired", {
            userId: session.userId,
            expiredAt: new Date(session.offlineValidUntil).toISOString(),
          });
        }
      }
    } catch (error) {
      console.debug("[Auth:init] Failed to restore offline session:", sanitizeError(error));
    }

    // Check if session is stale and needs refresh
    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    if (isStale) {
      console.log(
        "[Auth:init] Session is stale, dispatching refresh (will happen in background)"
      );
      dispatch(refreshSession());
    }

    console.log("[Auth:init] Initialization complete");
  } catch (e) {
    console.error("[Auth:init] Initialization error:", sanitizeError(e));
    // On any error, force logout
    tokenManager.clear();
    await tokenManager.clearSession().catch(() => {});
    await offlineSession.clear().catch(() => {});
    dispatch(setUnauthenticated());
  }
});
