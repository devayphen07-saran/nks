import * as crypto from 'crypto';

/**
 * Offline-session HMAC utilities.
 *
 * Both signing (TokenService at login/refresh) and verification (SyncService
 * on push) must serialize the payload identically. Centralising here ensures
 * both sides always produce the same byte string — any divergence silently
 * breaks all offline sync push operations.
 */

export interface OfflineSessionPayload {
  userId: number;
  storeId: number | null;
  roles: string[];
  offlineValidUntil: number; // Unix epoch ms — derived from offline JWT exp
}

function serialize(payload: OfflineSessionPayload): string {
  return JSON.stringify({
    userId: payload.userId,
    storeId: payload.storeId,
    roles: [...payload.roles].sort(),
    offlineValidUntil: payload.offlineValidUntil,
  });
}

/** Sign an offline session payload with HMAC-SHA256. Returns a 64-char hex string. */
export function signOfflineSession(
  payload: OfflineSessionPayload,
  secret: string,
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(serialize(payload))
    .digest('hex');
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
