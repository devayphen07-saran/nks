import {
  GET_ADMIN_ROUTES,
  GET_STORE_ROUTES,
} from "./api-data";

// ─── Routes ────────────────────────────────────────────────────────────────

export const getAdminRoutes = GET_ADMIN_ROUTES.generateAsyncThunk<void>("routes/getAdminRoutes");

export const getStoreRoutes = GET_STORE_ROUTES.generateAsyncThunk<{
  storeGuuid: string;
}>("routes/getStoreRoutes");
