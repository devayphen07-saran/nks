/**
 * write-guard — Prevents offline writes when the offline JWT has expired
 * or when the user lacks the required role.
 *
 * Usage:
 *   assertWriteAllowed();               // throws if expired
 *   assertWriteAllowed(['CASHIER']);     // also throws if role missing
 *
 * The offline window is determined by the offline token's `exp` claim.
 * Once expired, all PowerSync writes are blocked until the user reconnects
 * and obtains a fresh offline token from the server.
 */

import { JWTManager } from "./jwt-manager";
import { offlineSession } from "./offline-session";

export class OfflineSessionExpiredError extends Error {
  readonly code = "OFFLINE_SESSION_EXPIRED";

  constructor() {
    super(
      "Offline session has expired. Please reconnect to continue operations.",
    );
    this.name = "OfflineSessionExpiredError";
  }
}

export class InsufficientRoleError extends Error {
  readonly code = "INSUFFICIENT_ROLE";

  constructor(required: string[]) {
    super(`Write requires one of roles: ${required.join(", ")}`);
    this.name = "InsufficientRoleError";
  }
}

/**
 * Asserts that offline writes are currently allowed.
 *
 * Checks (in order):
 *   1. Offline JWT is not expired
 *   2. If `requiredRoles` provided, user holds at least one of them
 *
 * Both checks read in-memory / SecureStore state — no server I/O.
 *
 * @param requiredRoles Optional list of role codes; user must hold at least one.
 * @throws {OfflineSessionExpiredError} when offline window has expired
 * @throws {InsufficientRoleError} when user lacks required role
 */
export async function assertWriteAllowed(requiredRoles?: string[]): Promise<void> {
  const status = JWTManager.getOfflineStatus();

  if (status.mode === "offline_expired") {
    throw new OfflineSessionExpiredError();
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const session = await offlineSession.load();
    const userRoles: string[] = session?.roles ?? [];
    const hasRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new InsufficientRoleError(requiredRoles);
    }
  }
}

/**
 * Returns true if offline writes are currently allowed.
 * Non-throwing, synchronous version (JWT expiry check only).
 */
export function isWriteAllowed(): boolean {
  const status = JWTManager.getOfflineStatus();
  return status.mode !== "offline_expired";
}
