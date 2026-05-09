import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { setCredentials } from "./auth-slice";
import type { RootState, AppDispatch } from "./index";

/**
 * Updates defaultStoreGuuid in both Redux and SecureStore in one shot.
 *
 * Called after any operation that changes the user's default store:
 *   - Store creation (POST /stores — backend auto-sets first store as default)
 *   - Set default store (PUT /stores/default)
 *   - Accept invite flow (if the accepted store becomes default)
 *
 * Persisting to SecureStore ensures the correct store is loaded on cold start.
 * Without this, the app would redirect back to STORE_SETUP after a restart
 * because initializeAuth reads the stale session from SecureStore.
 */
export const patchAndPersistDefaultStore = createAsyncThunk<
  void,
  string,
  { dispatch: AppDispatch; state: RootState }
>("auth/patchAndPersistDefaultStore", async (storeGuuid, { dispatch, getState }) => {
  const current = getState().auth.authResponse;
  if (!current) return;

  const updated: AuthResponse = {
    ...current,
    context: {
      ...current.context,
      defaultStoreGuuid: storeGuuid,
    },
  };

  dispatch(setCredentials(updated));
  await tokenManager.persistSession(updated);
});
