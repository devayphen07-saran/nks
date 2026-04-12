/**
 * Zustand Auth Store — reactive auth state for offline-first mobile.
 *
 * Status lifecycle:
 *   idle → authenticated  (hydrate found valid offline token)
 *   idle → locked         (offline token expired — re-auth required)
 *   idle → unauthenticated (no tokens stored)
 *   authenticated → locked (offline window expired while app is open)
 *
 * This store is the single source of truth for auth status.
 * Use reactive selectors: `useAuthStore((s) => s.status)` — NOT getState().
 */

import { create } from "zustand";
import { JWTManager, type OfflineStatus } from "../lib/jwt-manager";
import { createLogger } from "../lib/logger";

const log = createLogger("AuthStore");

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthStatus =
  | "idle"            // Not yet hydrated
  | "authenticated"   // Has valid offline token (online or offline)
  | "locked"          // Offline token expired — must reconnect
  | "unauthenticated"; // No tokens at all — must login

export interface AuthUser {
  id: number;
  guuid: string;
  name?: string;
  phone?: string;
}

export interface AuthStoreState {
  status: AuthStatus;
  offlineStatus: OfflineStatus | null;
  user: AuthUser | null;
  storeId: number | null;
  // ─── Actions ───────────────────────────────────────────────────────────
  hydrate(): Promise<void>;
  setAuthenticated(user: AuthUser, storeId: number): void;
  setLocked(): void;
  setUnauthenticated(): void;
  updateOfflineStatus(): void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStoreState>()((set) => ({
  status: "idle",
  offlineStatus: null,
  user: null,
  storeId: null,

  /**
   * Reads JWTManager in-memory state (already hydrated from SecureStore)
   * and sets the initial auth status.
   *
   * Must be called AFTER `JWTManager.hydrate()` completes.
   */
  async hydrate() {
    log.info("Hydrating auth store...");

    const offlineStatus = JWTManager.getOfflineStatus();

    if (offlineStatus.mode === "offline_expired") {
      const hasRefreshToken = !!JWTManager.getRefreshToken();

      if (!hasRefreshToken) {
        // No tokens at all — fresh install or after logout
        log.info("No tokens found → unauthenticated");
        set({ status: "unauthenticated", offlineStatus: null });
        return;
      }

      // Has refresh token but offline expired — locked (needs re-auth or refresh)
      log.info("Offline token expired → locked");
      set({ status: "locked", offlineStatus });
      return;
    }

    // offline_valid or offline_warning — user is authenticated
    log.info(`Offline token valid (mode: ${offlineStatus.mode})`);
    set({ status: "authenticated", offlineStatus });
  },

  setAuthenticated(user: AuthUser, storeId: number) {
    const offlineStatus = JWTManager.getOfflineStatus();
    log.info(`Authenticated: user=${user.id} store=${storeId}`);
    set({ status: "authenticated", offlineStatus, user, storeId });
  },

  setLocked() {
    const offlineStatus = JWTManager.getOfflineStatus();
    log.warn("Auth locked — offline window expired");
    set({ status: "locked", offlineStatus });
  },

  setUnauthenticated() {
    log.info("Unauthenticated — tokens cleared");
    set({
      status: "unauthenticated",
      offlineStatus: null,
      user: null,
      storeId: null,
    });
  },

  /**
   * Refreshes the in-memory offline status from JWTManager.
   * Call this periodically (e.g., every 60s) to update the countdown UI.
   */
  updateOfflineStatus() {
    const offlineStatus = JWTManager.getOfflineStatus();

    if (offlineStatus.mode === "offline_expired") {
      set((state) => {
        if (state.status === "authenticated") {
          log.warn("Offline token expired while app was open → locking");
          return { status: "locked", offlineStatus };
        }
        return { offlineStatus };
      });
      return;
    }

    set({ offlineStatus });
  },
}));

// ─── Convenience selectors ───────────────────────────────────────────────────

/** Reactive status selector — use in components. */
export const useAuthStatus = () => useAuthStore((s) => s.status);

/** Reactive offline status selector for countdown UI. */
export const useOfflineStatus = () => useAuthStore((s) => s.offlineStatus);
