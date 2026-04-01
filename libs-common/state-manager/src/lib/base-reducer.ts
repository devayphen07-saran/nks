import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import { authSlice } from "./shared-slice/auth/slice";
import { storeSlice } from "./shared-slice/company/slice";
import { routesSlice } from "./shared-slice/routes/slice";
import { configMasterSlice } from "./slices/config-slice";

/* ── Reducer ─────────────────────────────────────────────────────────────── */

export const baseReducer = {
  auth: authSlice.reducer,
  store: storeSlice.reducer,
  routes: routesSlice.reducer,
  config: configMasterSlice.reducer,
};

/* ── Base Store ──────────────────────────────────────────────────────────── */

export const baseStore = configureStore({
  reducer: baseReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "auth/login/fulfilled",
          "auth/register/fulfilled",
          "auth/getSession/fulfilled",
          "auth/refreshToken/fulfilled",
          "routes/fetchUserRoutes/fulfilled",
          "routes/fetchAdminRoutesAndPermissions/fulfilled",
          "routes/fetchStoreRoutes/fulfilled",
          "lookup/countries/fulfilled",
          "lookup/currencies/fulfilled",
          "lookup/config/fulfilled",
        ],
      },
    }),
});

/* ── Types ───────────────────────────────────────────────────────────────── */

export type BaseStoreRootState = ReturnType<typeof baseStore.getState>;
export type BaseStoreDispatch = typeof baseStore.dispatch;

/* ── Typed Hooks ─────────────────────────────────────────────────────────── */

export const useBaseStoreDispatch = () => useDispatch<BaseStoreDispatch>();
export const useBaseStoreSelector: TypedUseSelectorHook<BaseStoreRootState> =
  useSelector;
