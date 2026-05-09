import type { SyncResult } from '../types/sync-result';

/**
 * Push response sent to mobile.
 *
 * `server_time` is the response-build timestamp (approximate, not
 * transactional). Each per-result `received_at` is stamped here too — the
 * handler layer stays unaware of response-time metadata.
 */
export interface PushResponse {
  server_time: string;
  results: SyncResult[];
}

/**
 * Stamp `received_at` on a single result. Preserves any value already set
 * by a handler (rare; handlers normally leave it undefined).
 */
function stampReceivedAt(result: SyncResult, serverTime: string): SyncResult {
  if (result.received_at) return result;
  return { ...result, received_at: serverTime };
}

/**
 * Build the push response envelope.
 * Handlers return raw SyncResult objects; the central stamp here keeps
 * timestamps consistent across all results in one batch.
 */
export function createPushResponse(results: SyncResult[]): PushResponse {
  const serverTime = new Date().toISOString();
  const stamped = results.map((result) => stampReceivedAt(result, serverTime));
  return {
    server_time: serverTime,
    results:     stamped,
  };
}
