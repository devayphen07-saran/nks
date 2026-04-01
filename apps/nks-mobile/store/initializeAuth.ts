import { createAsyncThunk } from "@reduxjs/toolkit";
import { AuthResponse, getAllCountry, getAllConfig } from "@nks/api-manager";
import { initializeDatabase, useAuth } from "@nks/local-db";
import { initialCategoryNames } from "../../../libs-common/shared-types/src/index";
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";
import { setCredentials, setUnauthenticated } from "../slice/authSlice";
import { refreshSession } from "./refreshSession";
import type { AppDispatch } from "./index";

// Called once when the app launches — restores session or sends user to login
export const initializeAuth = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/bootstrap", async (_, { dispatch }) => {
  try {
    // Initialize local database
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.warn("[Auth:init] Failed to initialize local database:", dbError);
      // Continue without local DB - it's optional
    }

    const envelope = await tokenManager.loadSession<AuthResponse>();

    if (!envelope?.data?.data?.session?.accessToken) {
      dispatch(setUnauthenticated());
      return;
    }

    tokenManager.set(envelope.data.data.session.accessToken);
    dispatch(setCredentials(envelope.data));

    // Restore auth data to local database if available
    try {
      const authDb = useAuth();
      const { user, session, access, flags } = envelope.data.data;
      const userId = parseInt(user.id, 10);

      // Parse timestamps from ISO strings
      const expiresAtMs = new Date(session.expiresAt).getTime();
      const refreshExpiresAtMs = new Date(session.refreshExpiresAt).getTime();
      const absoluteExpiryMs = new Date(session.absoluteExpiry).getTime();

      // Restore user profile
      await authDb.saveUser({
        userId,
        name: user.name || "",
        email: user.email || undefined,
        phoneNumber: user.phoneNumber || undefined,
        image: user.image || undefined,
        isSuperAdmin: access.isSuperAdmin,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneNumberVerified,
      });

      // Restore session
      await authDb.saveSession({
        userId,
        sessionId: session.sessionId,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        tokenType: session.tokenType,
        accessExpiresAt: expiresAtMs,
        refreshExpiresAt: refreshExpiresAtMs,
        absoluteExpiry: absoluteExpiryMs,
        mechanism: session.mechanism,
        isActive: true,
      });

      // Restore roles
      for (const role of access.roles) {
        await authDb.saveRole({
          userId,
          storeId: role.storeId,
          roleCode: role.roleCode,
          roleName: role.roleCode,
          permissions: [],
        });
      }

      // Restore flags
      for (const [flagCode, isEnabled] of Object.entries(flags)) {
        await authDb.saveFlag({
          flagCode,
          flagName: flagCode.replace(/_/g, " "),
          isEnabled,
        });
      }
    } catch (dbError) {
      console.warn("[Auth:init] Failed to restore auth data to local database:", dbError);
      // Continue even if DB restore fails
    }

    // Fetch initial global data after session is restored
    dispatch(getAllCountry());
    dispatch(
      getAllConfig({
        bodyParam: {
          categoryNames: initialCategoryNames,
        },
      })
    );

    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    if (isStale) dispatch(refreshSession());
  } catch (e) {
    console.error("[Auth:init] error:", e);
    dispatch(setUnauthenticated());
  }
});
