/**
 * Offline Session Validation
 * Validates offline session integrity and freshness.
 * Separated from data management for cleaner architecture.
 */

import * as crypto from "expo-crypto";
import { ONE_DAY_MS } from "@nks/utils";
import type { OfflineSession } from "./offline-session";

const OFFLINE_SESSION_INTEGRITY_SECRET =
  process.env["OFFLINE_SESSION_SECRET"] || "default-offline-session-secret";

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
    console.warn("[OfflineSessionValidator] No signature found, session may be tampered");
    return false;
  }

  try {
    const expectedSignature = await generateSignature(session);
    const isValid = session.signature === expectedSignature;

    if (!isValid) {
      console.error("[OfflineSessionValidator] Signature verification failed - session tampered!");
    }

    return isValid;
  } catch (error) {
    console.error("[OfflineSessionValidator] Signature verification error:", error);
    return false;
  }
}
