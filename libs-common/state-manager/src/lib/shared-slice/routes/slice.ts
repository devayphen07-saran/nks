import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getAdminRoutes, getStoreRoutes } from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { Route, RouteUser, RoutesState } from "./model";
import { routesCache } from "./cache";

const initialState: RoutesState = {
  user: null,
  routes: [],
  isSynced: false,
  fetchedAt: 0,
  error: null,
  fetchState: { ...defaultAPIState },
};

export const routesSlice = createSlice({
  name: "routes",
  initialState,
  reducers: {
    clearRoutes(state) {
      state.user = null;
      state.routes = [];
      state.isSynced = false;
      state.fetchedAt = 0;
      state.error = null;
      state.fetchState = { ...defaultAPIState };
      routesCache.clear();
    },

    setRoutes(state, action: PayloadAction<{ user: RouteUser; routes: Route[] }>) {
      state.user = action.payload.user;
      state.routes = action.payload.routes;
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      state.fetchState.isLoading = false;
    },
  },

  extraReducers: (builder) => {
    /* ── Admin Routes (SUPER_ADMIN) ── */
    builder.addCase(getAdminRoutes.pending, (state) => {
      state.fetchState.isLoading = true;
      state.fetchState.hasError = false;
      state.fetchState.errors = undefined;
    });

    builder.addCase(getAdminRoutes.fulfilled, (state, action) => {
      state.fetchState.isLoading = false;
      const data = action.payload?.data;
      state.user = data?.user ?? null;
      state.routes = data?.routes ?? [];
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      routesCache.save({
        routes: state.routes,
        isSynced: true,
        fetchedAt: state.fetchedAt,
      });
    });

    builder.addCase(getAdminRoutes.rejected, (state, action) => {
      state.fetchState.isLoading = false;
      state.fetchState.hasError = true;
      state.fetchState.errors = action.payload;
      state.error = (action.payload as any)?.message || "Failed to fetch admin routes";
      state.isSynced = false;
    });

    /* ── Store Routes ── */
    builder.addCase(getStoreRoutes.pending, (state) => {
      state.fetchState.isLoading = true;
      state.fetchState.hasError = false;
      state.fetchState.errors = undefined;
    });

    builder.addCase(getStoreRoutes.fulfilled, (state, action) => {
      state.fetchState.isLoading = false;
      const data = action.payload?.data;
      state.user = data?.user ?? null;
      state.routes = data?.routes ?? [];
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      routesCache.save({
        routes: state.routes,
        isSynced: true,
        fetchedAt: state.fetchedAt,
      });
    });

    builder.addCase(getStoreRoutes.rejected, (state, action) => {
      state.fetchState.isLoading = false;
      state.fetchState.hasError = true;
      state.fetchState.errors = action.payload;
      state.error = (action.payload as any)?.message || "Failed to fetch store routes";
      state.isSynced = false;
    });
  },
});

export const { clearRoutes, setRoutes } = routesSlice.actions;
