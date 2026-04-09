import { createAsyncThunk } from "@reduxjs/toolkit";
import { API } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { setCredentials, logout as logoutAction } from "./authSlice";
import type { AppDispatch } from "./index";

/**
 * Rotate the session using the stored refresh token.
 * Called when:
 *   - Persisted session is stale (>15 min old) on app launch
 *   - 403 received (permissions may have changed)
 *
 * On success: updates in-memory token + SecureStore + Redux
 * On failure: if refresh token is invalid/expired → force logout
 *             if network error → keep cached session (user stays logged in)
 */
export const refreshSession = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/refreshSession", async (_, { dispatch }) => {
  try {
    const envelope = await tokenManager.loadSession<any>();
    const refreshTokenValue = envelope?.data?.data?.session?.refreshToken;

    if (!refreshTokenValue) return;

    const response = await API.post("/auth/refresh-token", {
      refreshToken: refreshTokenValue,
    });

    const result = response.data?.data;
    const newSessionToken = result?.sessionToken;
    if (!newSessionToken || !envelope?.data) return;

    tokenManager.set(newSessionToken);

    const updated = {
      ...envelope.data,
      data: {
        ...envelope.data.data,
        session: {
          ...envelope.data.data.session,
          sessionToken: newSessionToken,
          ...(result?.refreshToken
            ? { refreshToken: result.refreshToken }
            : {}),
          ...(result?.expiresAt ? { expiresAt: result.expiresAt } : {}),
          ...(result?.refreshExpiresAt
            ? { refreshExpiresAt: result.refreshExpiresAt }
            : {}),
        },
      },
    };

    await tokenManager.persistSession(updated);
    dispatch(setCredentials(updated));
  } catch (e: unknown) {
    const status =
      e instanceof Error && "response" in e
        ? (e as any).response?.status
        : undefined;

    if (status === 401) {
      tokenManager.clear();
      await tokenManager.clearSession();
      dispatch(logoutAction());
    }
    // Network errors, 5xx → keep cached session alive
  }
});
