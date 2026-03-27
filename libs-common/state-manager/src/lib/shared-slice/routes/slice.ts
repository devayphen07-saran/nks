import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAdminRoutesAndPermissions,
  fetchStoreRoutes,
  type Route,
  type Permission,
} from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { RoutesState } from "./model";
import { routesCache } from "./cache";

const initialState: RoutesState = {
  routes: [],
  permissions: [],
  isSynced: false,
  fetchedAt: 0,
  error: null,
  fetchState: { ...defaultAPIState },
};

export const routesSlice = createSlice({
  name: "routes",
  initialState,
  reducers: {
    /**
     * Clear routes when user logs out
     * Resets isSynced to false to allow re-fetching on next login
     */
    clearRoutes(state) {
      state.routes = [];
      state.permissions = [];
      state.isSynced = false;
      state.fetchedAt = 0;
      state.error = null;
      state.fetchState = { ...defaultAPIState };
      routesCache.clear();
    },

    /**
     * Manually set routes (fallback/emergency data)
     */
    setRoutes(
      state,
      action: PayloadAction<{ routes: Route[]; permissions: Permission[] }>,
    ) {
      state.routes = action.payload.routes;
      state.permissions = action.payload.permissions;
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      state.fetchState.isLoading = false;
    },
  },

  extraReducers: (builder) => {
    /* ── Admin Routes & Permissions ── */
    builder.addCase(fetchAdminRoutesAndPermissions.pending, (state) => {
      state.fetchState.isLoading = true;
      state.fetchState.hasError = false;
      state.fetchState.errors = undefined;
    });

    builder.addCase(
      fetchAdminRoutesAndPermissions.fulfilled,
      (state, action) => {
        state.fetchState.isLoading = false;
        // Response structure: ApiResponse<RoutesAndPermissionsData>
        const data = action.payload?.data;
        state.routes = data?.routes || [];
        state.permissions = data?.permissions || [];
        state.isSynced = true;
        state.fetchedAt = Date.now();
        state.error = null;
        // Cache routes for session persistence
        routesCache.save({
          routes: state.routes,
          permissions: state.permissions,
          isSynced: true,
          fetchedAt: state.fetchedAt,
        });
      },
    );

    builder.addCase(
      fetchAdminRoutesAndPermissions.rejected,
      (state, action) => {
        state.fetchState.isLoading = false;
        state.fetchState.hasError = true;
        state.fetchState.errors = action.payload;
        state.error =
          (action.payload as any)?.message || "Failed to fetch admin routes";
        state.isSynced = false;
        console.error("[Redux] Failed to sync admin routes:", action.payload);
      },
    );

    /* ── Store Routes ── */
    builder.addCase(fetchStoreRoutes.pending, (state) => {
      state.fetchState.isLoading = true;
      state.fetchState.hasError = false;
      state.fetchState.errors = undefined;
    });

    builder.addCase(fetchStoreRoutes.fulfilled, (state, action) => {
      state.fetchState.isLoading = false;
      // Response structure: ApiResponse<RoutesAndPermissionsData>
      const data = action.payload?.data;
      state.routes = data?.routes || [];
      state.permissions = data?.permissions || [];
      state.isSynced = true;
      state.fetchedAt = Date.now();
      state.error = null;
      // Cache routes for session persistence
      routesCache.save({
        routes: state.routes,
        permissions: state.permissions,
        isSynced: true,
        fetchedAt: state.fetchedAt,
      });
    });

    builder.addCase(fetchStoreRoutes.rejected, (state, action) => {
      state.fetchState.isLoading = false;
      state.fetchState.hasError = true;
      state.fetchState.errors = action.payload;
      state.error =
        (action.payload as any)?.message || "Failed to fetch store routes";
      state.isSynced = false;
      console.error("[Redux] Failed to sync store routes:", action.payload);
    });
  },
});

export const { clearRoutes, setRoutes } = routesSlice.actions;
