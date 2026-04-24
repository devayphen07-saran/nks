import * as crypto from 'crypto';

/**
 * Offline-session HMAC utilities.
 *
 * Both signing (TokenService on login) and verification (SyncService on push)
 * must serialize the payload in exactly the same way. Any divergence silently
 * breaks all offline push operations. Centralising here ensures both sides
 * always produce the same byte string.
 */

export interface OfflineSessionPayload {
  userGuuid: string;
  storeGuuid: string | null;
  roles: string[];
  offlineValidUntil: number;
}

/**
 * Canonical JSON representation of the offline session payload.
 * Roles are sorted to ensure key-order-independent equality.
 */
function serialize(payload: OfflineSessionPayload): string {
  return JSON.stringify({
    userGuuid: payload.userGuuid,
    storeGuuid: payload.storeGuuid,
    roles: [...payload.roles].sort(),
    offlineValidUntil: payload.offlineValidUntil,
  });
}

/** Sign an offline session payload with HMAC-SHA256. */
export function signOfflineSession(
  payload: OfflineSessionPayload,
  secret: string,
): string {
  return crypto.createHmac('sha256', secret).update(serialize(payload)).digest('hex');
}

/** Verify an offline session HMAC using timing-safe comparison. */
export function verifyOfflineSession(
  payload: OfflineSessionPayload,
  secret: string,
  signature: string,
): boolean {
  const expected = signOfflineSession(payload, secret);
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
