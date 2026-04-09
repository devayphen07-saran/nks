import { createAsyncThunk } from "@reduxjs/toolkit";
import { signOut } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { logout as logoutAction } from "./authSlice";
import type { AppDispatch } from "./index";

export const logoutThunk = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/logout", async (_, { dispatch }) => {
  // Call sign-out BEFORE clearing the token so the Authorization header is
  // present and BetterAuth can invalidate the server-side session.
  try {
    await dispatch(signOut({}));
  } catch {}
  tokenManager.clear();
  await tokenManager.clearSession();
  dispatch(logoutAction());
});
