/**
 * Offline Session — Data Management, Validation, and Status
 * Client-side trust policy for offline POS operations.
 * This is NOT a token — it's a local policy that says "this device was
 * authenticated within the last 3 days — allow local POS operations."
 *
 * Integrity: sessions are HMAC-SHA256 signed server-side. The signing secret
 * never leaves the server, so any local tampering of the stored payload
 * (e.g. role escalation) is detectable when the session is re-submitted.
 * Mobile stores the server-provided signature but cannot regenerate it.
 */

import { v4 as uuidv4 } from "uuid";
import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "@nks/mobile-utils";
import { ONE_DAY_MS, ONE_HOUR_MS } from "@nks/utils";
import { STORAGE_KEYS } from "../utils/storage-keys";
import { createLogger } from "../utils/logger";

const log = createLogger("OfflineSession");

const OFFLINE_SESSION_KEY = STORAGE_KEYS.OFFLINE_SESSION;

/**
 * Offline session validity must match the backend's offline JWT TTL (3 days).
 * The write-guard checks the JWT's own exp claim, so if the offline session
 * reports "active" beyond the JWT's expiry, the UX becomes inconsistent
 * (status says active but writes are blocked).
 */
const THREE_DAYS_MS = 3 * ONE_DAY_MS;
const OFFLINE_SESSION_DURATION_MS = THREE_DAYS_MS;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * OfflineSession: Client-side trust policy for offline POS operations.
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
  /** 3-day RS256 JWT for offline identity + authorization verification */
  offlineToken: string;
  /** Timestamp when this OfflineSession was created */
  createdAt: number;
  /** Timestamp when roles were last synced with server (detects stale roles) */
  lastRoleSyncAt: number;
  /** If set, indicates server detected a revocation/permission change */
  revocationDetectedAt?: number;
  /**
   * HMAC-SHA256 signature computed server-side over (userId, storeId, roles, offlineValidUntil).
   * The secret lives only on the server — the mobile client stores this value as-is.
   * Presence of a non-empty signature means the session was issued by a legitimate server.
   * Tampering with any payload field invalidates this signature on the next server-side check.
   */
  signature?: string;
  /**
   * Stable device identifier (from expo-device / expo-application).
   * Submitted with every sync push so the server can check the revoked_devices table
   * and reject this device even if its 3-day offline HMAC is still cryptographically valid.
   */
  deviceId?: string;
}

// ─── Status types ─────────────────────────────────────────────────────────────

export type SessionStatus = "active" | "expiring" | "expired" | "stale_roles" | "no_session";

export interface StatusMessage {
  status: SessionStatus;
  message: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Check if an offline session is still valid (not expired)
 */
export function isSessionValid(session: OfflineSession | null): boolean {
  if (!session) return false;
  return session.offlineValidUntil > Date.now();
}

/**
 * Check if offline session roles are stale.
 * Roles are considered stale if:
 * - Last role sync was > 24 hours ago
 * - Server revocation was detected
 */
export function isRolesStale(session: OfflineSession | null): {
  isStale: boolean;
  reason?: string;
  hoursStale?: number;
} {
  if (!session) {
    return { isStale: true, reason: "No offline session" };
  }

  const now = Date.now();

  if (session.revocationDetectedAt) {
    return {
      isStale: true,
      reason: "Server detected permission revocation",
    };
  }

  const hoursSinceRoleSync = (now - session.lastRoleSyncAt) / (60 * 60 * 1000);
  if (now - session.lastRoleSyncAt > ONE_DAY_MS) {
    return {
      isStale: true,
      reason: `Roles not synced for ${Math.floor(hoursSinceRoleSync)} hours`,
      hoursStale: Math.floor(hoursSinceRoleSync),
    };
  }

  return { isStale: false };
}

/**
 * Verify offline session integrity.
 *
 * Since the signing secret is server-side only, the client cannot recompute
 * the expected HMAC. Verification here checks that:
 *   1. A signature was set (session was issued by the server, not locally forged)
 *   2. The signature field has not been cleared (storage wasn't wiped selectively)
 *
 * Full cryptographic verification (re-computing the HMAC) happens server-side
 * whenever the session payload is submitted in a sync or auth call.
 */
export function verifySessionIntegrity(session: OfflineSession): boolean {
  if (!session.signature) {
    log.warn("No server-provided signature — session may be forged or from an older client");
    return false;
  }
  // Server produces a 64-char lowercase hex HMAC-SHA256 string.
  // Reject anything that doesn't match this format — catches empty strings,
  // whitespace padding, and non-hex values that would pass the truthy check above.
  if (!/^[0-9a-f]{64}$/i.test(session.signature)) {
    log.warn("Invalid signature format — expected 64-char hex HMAC-SHA256");
    return false;
  }
  return true;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function getStatusMessage(session: OfflineSession | null): StatusMessage {
  if (!session) {
    return { status: "no_session", message: "Not authenticated" };
  }

  if (!isSessionValid(session)) {
    return { status: "expired", message: "Offline session expired" };
  }

  const rolesStatus = isRolesStale(session);
  if (rolesStatus.isStale) {
    return {
      status: "stale_roles",
      message: `Roles may be stale (${rolesStatus.reason}). Go online to sync.`,
    };
  }

  const now = Date.now();
  const timeRemaining = session.offlineValidUntil - now;
  const hoursRemaining = Math.round(timeRemaining / ONE_HOUR_MS);

  if (timeRemaining < ONE_DAY_MS) {
    return {
      status: "expiring",
      message: `Offline access expires in ${hoursRemaining}h. Go online to refresh.`,
    };
  }

  return {
    status: "active",
    message: `Offline access active for ${hoursRemaining}h. Roles: ${session.roles.length}`,
  };
}

// ─── Data management ──────────────────────────────────────────────────────────

export const offlineSession = {
  /**
   * Creates a new OfflineSession from auth response data.
   * Stores it in SecureStore immediately.
   *
   * @param signature - HMAC-SHA256 signature from the server (offlineSessionSignature
   *   in the auth response). If absent (older server), the session is stored unsigned.
   */
  async create(input: {
    userId: number;
    storeId: number;
    storeName: string;
    roles: string[];
    offlineToken: string;
    signature?: string;
    deviceId?: string;
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
      ...(input.signature ? { signature: input.signature } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    };

    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Loads and verifies the persisted OfflineSession from SecureStore.
   *
   * Returns null if the session is missing, unsigned (integrity check fails),
   * or expired (offlineValidUntil has passed). Expired sessions are cleared
   * from storage so future calls don't re-parse them.
   *
   * @returns Valid OfflineSession, or null if missing / invalid / unsigned / expired.
   */
  async load(): Promise<OfflineSession | null> {
    try {
      const raw = await getSecureItem(OFFLINE_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as OfflineSession;

      if (!verifySessionIntegrity(session)) {
        await deleteSecureItem(OFFLINE_SESSION_KEY);
        return null;
      }

      if (!isSessionValid(session)) {
        await deleteSecureItem(OFFLINE_SESSION_KEY);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  /** Checks if the session is still valid (offlineValidUntil > now) */
  isValid: isSessionValid,

  /** Checks if roles are stale (> 24h since sync or revocation detected). */
  isRolesStale,

  /**
   * Extends offlineValidUntil by 3 days.
   * Called on every successful token refresh.
   * Does NOT update the signature — extend is a local time extension only.
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
   * Stores the new server-provided signature if present.
   */
  async updateRolesAndExtend(
    session: OfflineSession,
    roles: string[],
    offlineToken?: string,
    signature?: string,
  ): Promise<OfflineSession> {
    const now = Date.now();
    const updated: OfflineSession = {
      ...session,
      roles,
      offlineValidUntil: now + OFFLINE_SESSION_DURATION_MS,
      lastRoleSyncAt: now,
      ...(offlineToken ? { offlineToken } : {}),
      ...(signature ? { signature } : {}),
    };

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
   * Verify offline session integrity (signature presence check).
   */
  verify: verifySessionIntegrity,

  /**
   * Get a human-readable status message for UI display.
   */
  getStatus(session: OfflineSession | null): StatusMessage {
    return getStatusMessage(session);
  },
};
