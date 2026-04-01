import { AuthResponse, getUserDetails } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { initializeDatabase, useAuth } from "@nks/local-db";
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
  } catch (error) {
    // Storage write failed (full, permission denied, etc.).
    // Token is still alive in memory for this session — user can continue,
    // but will be logged out on next app restart.
  }

  dispatch(setCredentials(authResponse));

  // ──── Save auth data to local WatermelonDB ────
  try {
    // Initialize database if needed
    await initializeDatabase();

    const authDb = useAuth();
    const { user, session, access, flags } = authResponse.data;
    const userId = parseInt(user.id, 10);

    // Parse timestamps from ISO strings
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const refreshExpiresAtMs = new Date(session.refreshExpiresAt).getTime();
    const absoluteExpiryMs = new Date(session.absoluteExpiry).getTime();

    // 1. Save user profile
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

    // 2. Save session with tokens
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

    // 3. Save user roles
    for (const role of access.roles) {
      await authDb.saveRole({
        userId,
        storeId: role.storeId,
        roleCode: role.roleCode,
        roleName: role.roleCode, // Use roleCode as name for now (can be improved)
        permissions: [], // Permissions will be loaded per request
      });
    }

    // 4. Save feature flags
    for (const [flagCode, isEnabled] of Object.entries(flags)) {
      await authDb.saveFlag({
        flagCode,
        flagName: flagCode.replace(/_/g, " "),
        isEnabled,
      });
    }
  } catch (error) {
    console.warn("Failed to save auth data to local database:", error);
    // Continue even if local DB save fails - user can still work
  }

  // Fetch user profile details after login
  try {
    await dispatch(getUserDetails());
  } catch (error) {
    // User details fetch failed, but user can still proceed with basic auth data
  }
}
