/**
 * write-guard — Prevents offline writes when the offline JWT has expired,
 * when the user lacks the required role, or when JWKS is too stale to verify.
 *
 * Usage:
 *   assertWriteAllowed();               // throws if expired or unverifiable
 *   assertWriteAllowed(['CASHIER']);     // also throws if role missing
 *
 * The offline window is determined by the offline token's `exp` claim.
 * Once expired, all offline writes are blocked until the user reconnects
 * and obtains a fresh offline token from the server.
 */

import { JWTManager } from "lib/auth";
import { offlineSession } from "lib/auth";
import { arePermissionsLoaded } from "lib/sync/sync-status";

class OfflineSessionExpiredError extends Error {
  readonly code = "OFFLINE_SESSION_EXPIRED";

  constructor() {
    super(
      "Offline session has expired. Please reconnect to continue operations.",
    );
    this.name = "OfflineSessionExpiredError";
  }
}

class InsufficientRoleError extends Error {
  readonly code = "INSUFFICIENT_ROLE";

  constructor(required: string[]) {
    super(`Write requires one of roles: ${required.join(", ")}`);
    this.name = "InsufficientRoleError";
  }
}

class JwksUnavailableError extends Error {
  readonly code = "JWKS_UNAVAILABLE";

  constructor() {
    super(
      "Cannot verify offline credentials — key data is outdated. " +
        "Please go online to sync before performing this operation.",
    );
    this.name = "JwksUnavailableError";
  }
}

class PermissionsNotLoadedError extends Error {
  readonly code = "PERMISSIONS_NOT_LOADED";

  constructor() {
    super(
      "Permission data has not been synced yet. " +
        "Please connect to the internet and sync before performing offline operations.",
    );
    this.name = "PermissionsNotLoadedError";
  }
}

/**
 * Asserts that offline writes are currently allowed.
 *
 * Checks (in order):
 *   1. JWKS cache is fresh enough to verify the offline token (≤ 7 days old)
 *   2. Offline JWT is not expired
 *   3. If `requiredRoles` provided, user holds at least one of them
 *
 * All checks read in-memory / SecureStore state — no server I/O.
 *
 * @param requiredRoles Optional list of role codes; user must hold at least one.
 * @throws {JwksUnavailableError} when JWKS cache is too stale to verify tokens
 * @throws {OfflineSessionExpiredError} when offline window has expired
 * @throws {InsufficientRoleError} when user lacks required role
 */
export async function assertWriteAllowed(
  requiredRoles?: string[],
): Promise<void> {
  // entity_permissions must have been synced at least once before we allow offline
  // writes. Without permissions data, every can() check would silently fail-safe
  // to false — blocking all writes. Better to surface a clear error here.
  const permissionsLoaded = await arePermissionsLoaded();
  if (!permissionsLoaded) {
    throw new PermissionsNotLoadedError();
  }

  // JWKS must be fresh enough to verify the offline token's authenticity.
  // If the cached public key is > 7 days old and we're offline, we cannot
  // safely verify — block the write and prompt the user to reconnect.
  if (!JWTManager.isJwksFresh()) {
    throw new JwksUnavailableError();
  }

  const status = JWTManager.getOfflineStatus();

  if (status.mode === "offline_expired") {
    throw new OfflineSessionExpiredError();
  }

  if (requiredRoles && requiredRoles.length > 0) {
    // load() performs HMAC integrity verification internally —
    // tampered sessions (e.g. role escalation) are rejected and return null.
    const session = await offlineSession.load();
    if (!session) {
      throw new InsufficientRoleError(requiredRoles);
    }

    const hasRole = requiredRoles.some((r) => session.roles.includes(r));
    if (!hasRole) {
      throw new InsufficientRoleError(requiredRoles);
    }
  }
}

export {
  JwksUnavailableError,
  OfflineSessionExpiredError,
  InsufficientRoleError,
  PermissionsNotLoadedError,
};
