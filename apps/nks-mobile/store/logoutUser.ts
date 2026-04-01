import { createAsyncThunk } from "@reduxjs/toolkit";
import { initializeDatabase } from "@nks/local-db";
import { tokenManager } from "@nks/mobile-utils";
import { logout } from "../slice/authSlice";
import { clearAuthData } from "./tokenRefreshService";
import type { AppDispatch } from "./index";

/**
 * Logout thunk - clears auth from Redux, local DB, and token storage
 */
export const logoutUser = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/logout", async (_, { dispatch }) => {
  try {
    // Clear token from memory
    tokenManager.clear?.();
  } catch (error) {
    console.warn("Failed to clear token manager:", error);
  }

  try {
    // Clear token from secure storage
    await tokenManager.persistSession?.(null as any);
  } catch (error) {
    console.warn("Failed to clear persistent session:", error);
  }

  try {
    // Clear local database
    await initializeDatabase();
    await clearAuthData();
  } catch (error) {
    console.warn("Failed to clear local database:", error);
  }

  // Clear Redux state
  dispatch(logout());
});

/**
 * Simple logout function (non-thunk version)
 */
export async function performLogout(dispatch: AppDispatch): Promise<void> {
  try {
    // Clear token from memory
    tokenManager.clear?.();
  } catch (error) {
    console.warn("Failed to clear token manager:", error);
  }

  try {
    // Clear token from secure storage
    await tokenManager.persistSession?.(null as any);
  } catch (error) {
    console.warn("Failed to clear persistent session:", error);
  }

  try {
    // Clear local database
    await initializeDatabase();
    await clearAuthData();
  } catch (error) {
    console.warn("Failed to clear local database:", error);
  }

  // Clear Redux state
  dispatch(logout());
}
