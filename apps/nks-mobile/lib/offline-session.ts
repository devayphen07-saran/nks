/**
 * Offline Session — Data Management
 * Client-side trust policy for offline POS operations.
 * This is NOT a token — it's a local policy that says "this device was
 * authenticated within the last 5 days — allow local POS operations."
 *
 * Validation logic: offline-session-validator.ts
 * UI status messages: offline-session-status.ts
 */

import { v4 as uuidv4 } from "uuid";
import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "@nks/mobile-utils";
import { FIVE_DAYS_MS } from "@nks/utils";
import {
  isSessionValid,
  isRolesStale,
  generateSignature,
  verifySessionIntegrity,
} from "./offline-session-validator";
import { getStatusMessage, type StatusMessage } from "./offline-session-status";

const OFFLINE_SESSION_KEY = "nks_offline_session";

/**
 * CRITICAL FIX #1: Reduced offline window from 7 days to 5 days.
 * Balances offline capability with revocation risk.
 */
export const OFFLINE_SESSION_DURATION_MS = FIVE_DAYS_MS;

/**
 * OfflineSession: Client-side trust policy for offline POS operations.
 * CRITICAL FIX: Includes revocation awareness and role sync timestamps.
 */
export interface OfflineSession {
  /** Unique identifier for this offline session (UUID) — used in outbox audit trail */
  id: string;
  /** User ID from auth response */
  userId: number;
  /** Store ID selected during login */
  storeId: number;
  /** Store name for UI display */
  storeName: string;
  /** User roles from auth response */
  roles: string[];
  /** Unix timestamp — session valid until this time. Extends only on successful server refresh. */
  offlineValidUntil: number;
  /** Timestamp of last successful data sync (products, customers, tax_rates) */
  lastSyncedAt: number;
  /** 5-day RS256 JWT for offline identity + authorization verification */
  offlineToken: string;
  /** Timestamp when this OfflineSession was created */
  createdAt: number;
  /** CRITICAL FIX: Timestamp when roles were last synced with server (detects stale roles) */
  lastRoleSyncAt: number;
  /** CRITICAL FIX: If set, indicates server detected a revocation/permission change */
  revocationDetectedAt?: number;
  /** CRITICAL FIX #8.1: HMAC-SHA256 signature — prevents role tampering (e.g., STAFF→STORE_OWNER) */
  signature?: string;
}

export const offlineSession = {
  /**
   * Creates a new OfflineSession from auth response data.
   * Stores it in SecureStore immediately.
   * CRITICAL FIX: Tracks lastRoleSyncAt to detect stale roles.
   */
  async create(input: {
    userId: number;
    storeId: number;
    storeName: string;
    roles: string[];
    offlineToken: string;
  }): Promise<OfflineSession> {
    const now = Date.now();
    const session: OfflineSession = {
      id: uuidv4(),
      userId: input.userId,
      storeId: input.storeId,
      storeName: input.storeName,
      roles: input.roles,
      offlineValidUntil: now + OFFLINE_SESSION_DURATION_MS,
      lastSyncedAt: now,
      lastRoleSyncAt: now,
      offlineToken: input.offlineToken,
      createdAt: now,
    };

    session.signature = await generateSignature(session);
    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Loads the persisted OfflineSession from SecureStore.
   * Returns null if not found or JSON parsing fails.
   */
  async load(): Promise<OfflineSession | null> {
    try {
      const raw = await getSecureItem(OFFLINE_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OfflineSession;
    } catch {
      return null;
    }
  },

  /** Checks if the session is still valid (offlineValidUntil > now) */
  isValid: isSessionValid,

  /**
   * CRITICAL FIX #4.2: Checks if roles are stale (> 24h since sync or revocation detected).
   * Prompt user to go online to refresh roles when stale.
   */
  isRolesStale,

  /**
   * Extends offlineValidUntil by 5 days.
   * Called on every successful token refresh.
   */
  async extendValidity(session: OfflineSession): Promise<OfflineSession> {
    const updated = {
      ...session,
      offlineValidUntil: Date.now() + OFFLINE_SESSION_DURATION_MS,
    };
    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Updates roles and extends validity after token refresh.
   * CRITICAL FIX #1: Syncs new role data and updates lastRoleSyncAt.
   * CRITICAL FIX #8.1: Regenerates HMAC signature after role update.
   */
  async updateRolesAndExtend(
    session: OfflineSession,
    roles: string[],
    offlineToken?: string,
  ): Promise<OfflineSession> {
    const now = Date.now();
    const updated: OfflineSession = {
      ...session,
      roles,
      offlineValidUntil: now + OFFLINE_SESSION_DURATION_MS,
      lastRoleSyncAt: now,
      ...(offlineToken ? { offlineToken } : {}),
    };

    updated.signature = await generateSignature(updated);
    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Clears the OfflineSession from SecureStore.
   * Called on logout or remote wipe.
   */
  async clear(): Promise<void> {
    await deleteSecureItem(OFFLINE_SESSION_KEY);
  },

  /**
   * CRITICAL FIX #8.1: Verify offline session HMAC integrity.
   * Returns false if session has been tampered with.
   */
  verify: verifySessionIntegrity,

  /**
   * CRITICAL FIX #8.1: Generate HMAC signature for offline session.
   */
  sign: generateSignature,

  /**
   * Get a human-readable status message for UI display.
   * Delegates to offline-session-status.ts.
   */
  getStatus(session: OfflineSession | null): StatusMessage {
    return getStatusMessage(session);
  },
};
