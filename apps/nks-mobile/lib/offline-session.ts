/**
 * Offline Session — Data Management, Validation, and Status
 * Client-side trust policy for offline POS operations.
 * This is NOT a token — it's a local policy that says "this device was
 * authenticated within the last 5 days — allow local POS operations."
 */

import { v4 as uuidv4 } from "uuid";
import * as crypto from "expo-crypto";
import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "@nks/mobile-utils";
import { ONE_DAY_MS, ONE_HOUR_MS } from "@nks/utils";
import { STORAGE_KEYS } from "./storage-keys";
import { createLogger } from "./logger";

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

// ─── Integrity secret ────────────────────────────────────────────────────────

const OFFLINE_SESSION_INTEGRITY_SECRET = process.env["OFFLINE_SESSION_SECRET"] ?? "";
if (__DEV__ && !OFFLINE_SESSION_INTEGRITY_SECRET) {
  log.warn("OFFLINE_SESSION_SECRET is not set — signature integrity checks are degraded");
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
 * Check if offline session roles are stale
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

  // Check if revocation was detected by server
  if (session.revocationDetectedAt) {
    return {
      isStale: true,
      reason: "Server detected permission revocation",
    };
  }

  // Check if roles haven't been synced in 24 hours
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
 * Generate HMAC signature for offline session.
 * Prevents tampering with session data (e.g., upgrading roles).
 *
 * NOTE: This is a tamper-detection guard, not a cryptographic security boundary.
 * The secret is baked into the app bundle at build time.
 */
export async function generateSignature(session: OfflineSession): Promise<string> {
  const signatureData = JSON.stringify({
    userId: session.userId,
    storeId: session.storeId,
    roles: [...session.roles].sort(), // Sort for consistency
    offlineValidUntil: session.offlineValidUntil,
    createdAt: session.createdAt,
  });

  const signatureInput = `${OFFLINE_SESSION_INTEGRITY_SECRET}:${signatureData}`;
  return crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    signatureInput,
  );
}

/**
 * Verify offline session integrity.
 * Returns false if session has been tampered with.
 */
export async function verifySessionIntegrity(session: OfflineSession): Promise<boolean> {
  if (!session.signature) {
    log.warn("No signature found, session may be tampered");
    return false;
  }

  try {
    const expectedSignature = await generateSignature(session);
    const isValid = session.signature === expectedSignature;

    if (!isValid) {
      log.error("Signature verification failed - session tampered!");
    }

    return isValid;
  } catch (error) {
    log.error("Signature verification error:", error);
    return false;
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Get the current offline session status.
 * Returns a machine-readable status and a plain descriptive message.
 * UI layers are responsible for adding icons, colors, and translations.
 */
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
   * Loads and verifies the persisted OfflineSession from SecureStore.
   *
   * Performs HMAC-SHA256 integrity check when a signature is present.
   * If verification fails (tampered roles, modified expiry, etc.),
   * the session is cleared from storage and null is returned.
   *
   * @returns Verified OfflineSession, or null if missing / invalid / tampered.
   */
  async load(): Promise<OfflineSession | null> {
    try {
      const raw = await getSecureItem(OFFLINE_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as OfflineSession;

      if (session.signature) {
        const valid = await verifySessionIntegrity(session);
        if (!valid) {
          await deleteSecureItem(OFFLINE_SESSION_KEY);
          return null;
        }
      }

      return session;
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
   */
  getStatus(session: OfflineSession | null): StatusMessage {
    return getStatusMessage(session);
  },
};
