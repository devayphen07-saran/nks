/**
 * write-guard — Prevents offline writes when the offline JWT has expired.
 *
 * Usage:
 *   assertWriteAllowed(); // throws if offline window expired
 *
 * The offline window is determined by the offline token's `exp` claim.
 * Once expired, all PowerSync writes are blocked until the user reconnects
 * and obtains a fresh offline token from the server.
 */

import { JWTManager } from "./jwt-manager";

export class OfflineSessionExpiredError extends Error {
  readonly code = "OFFLINE_SESSION_EXPIRED";

  constructor() {
    super(
      "Offline session has expired. Please reconnect to continue operations.",
    );
    this.name = "OfflineSessionExpiredError";
  }
}

/**
 * Asserts that offline writes are currently allowed.
 *
 * Throws `OfflineSessionExpiredError` if the offline JWT has expired.
 * This is a synchronous check against in-memory token state — no I/O.
 *
 * @throws {OfflineSessionExpiredError} when offline window has expired
 */
export function assertWriteAllowed(): void {
  const status = JWTManager.getOfflineStatus();

  if (status.mode === "offline_expired") {
    throw new OfflineSessionExpiredError();
  }
}

/**
 * Returns true if offline writes are currently allowed.
 * Non-throwing version of `assertWriteAllowed()`.
 */
export function isWriteAllowed(): boolean {
  const status = JWTManager.getOfflineStatus();
  return status.mode !== "offline_expired";
}
