import { useCallback } from "react";
import { useRootDispatch, useAuth } from "../store";
import { logoutThunk } from "../store/logout-thunk";

/** Dispatch logoutThunk and optionally run a success callback. */
export const useLogout = () => {
  const dispatch = useRootDispatch();
  const authState = useAuth();
  const isLoggedIn = !!authState.authResponse;

  const logout = useCallback(
    async (onSuccess?: () => void) => {
      await dispatch(logoutThunk());
      onSuccess?.();
    },
    [dispatch],
  );

  return { logout, isLoggedIn };
};
