import { useState } from "react";
import { router } from "expo-router";
import { useCreateStore, type CreateStoreRequest } from "@nks/api-manager";
import { useRootDispatch } from "../../../store";
import { patchAndPersistDefaultStore } from "../../../store/patch-default-store";
import { ROUTES } from "../../../lib/navigation/routes";
import { handleError } from "../../../shared/errors";
import { refreshLocalStores } from "../../../lib/store/initialize-stores";
import { setActiveStoreByGuuid } from "../../../lib/store/active-store";
import type { StoreFormValues } from "./useStoreSetupForm";

/**
 * Submit handler for the store-create form.
 *
 * Store creation is online-only. Steps:
 *   1. POST /stores → backend returns { storeGuuid }.
 *   2. Refresh /stores/me so the new store (with its numeric id) lands in
 *      local SQLite. This is the parent row for sync_metadata / store_cache.
 *   3. Patch the auth response so defaultStoreGuuid points to the new store
 *      both in Redux and SecureStore — survives a cold restart.
 *   4. Set the active store and navigate to STORE_HOME.
 *
 * Address and tax fields collected by the form are not yet accepted by the
 * create endpoint and are dropped here.
 */
export const useStoreSetupSubmit = () => {
  const dispatch = useRootDispatch();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: createStore, isPending } = useCreateStore();

  const handleSubmit = async (values: StoreFormValues) => {
    setErrorMessage(null);

    const payload: CreateStoreRequest = {
      storeName:          values.storeName,
      storeLegalTypeCode: values.storeLegalTypeCode,
      storeCategoryCode:  values.storeCategoryCode,
      ...(values.storeCode ? { storeCode: values.storeCode } : {}),
    };

    try {
      const response = await createStore(payload);
      const storeGuuid = response?.data?.storeGuuid;
      if (!storeGuuid) {
        setErrorMessage("Store created but no identifier returned.");
        return;
      }

      await refreshLocalStores();
      await dispatch(patchAndPersistDefaultStore(storeGuuid));
      await setActiveStoreByGuuid(dispatch, storeGuuid);

      router.replace(ROUTES.STORE_HOME);
    } catch (err) {
      const appError = handleError(err, { action: "create_store" });
      setErrorMessage(appError.getUserMessage());
    }
  };

  return {
    handleSubmit,
    isLoading: isPending,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
};
