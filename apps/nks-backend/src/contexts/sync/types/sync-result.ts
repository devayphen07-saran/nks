/**
 * SyncResult is the response from a single push operation.
 *
 * Idempotency: `client_op_id` is the idempotency key. Repeated pushes of the
 * same `client_op_id` after success return `duplicate` (cached in
 * `processed_operations`) — no separate `idempotencyKey` field is needed.
 *
 * `received_at` (server timestamp) is stamped centrally in `createPushResponse`
 * before the result is sent to the client; handlers do not populate it.
 *
 * Statuses:
 *
 * ok
 *   Operation succeeded. Returned for create/update/delete that succeeded.
 *
 * duplicate
 *   Create: entity with this UUID already exists. Device may retry safely.
 *
 * conflict
 *   Update/Delete: version mismatch (device sent expected_version that doesn't match).
 *   Server returns current state and (optionally) a context block describing
 *   what changed, so the device can drive a rich resolution UI.
 *
 * rejected
 *   Operation failed validation (not found, invalid, business rule violation).
 *   Not retryable. Device quarantines in failed_operations.
 *
 * error
 *   Transient error (DB timeout, network issue, etc.). NOT CACHED.
 *   Device retries automatically with backoff. Safe to retry indefinitely.
 */

/**
 * Optional rich-conflict context attached to `conflict` results.
 * Mobile uses this to explain to the user what changed without needing to diff
 * `server_state` against the local payload itself. All fields are optional —
 * handlers may omit the whole context if no useful info is available.
 */
export interface ConflictContext {
  /** Human-readable label for the entity, e.g. "Customer 'Asha Kumar'". */
  description?: string;
  /**
   * Field names whose server value differs from the device's payload.
   * Empty array means the version mismatched but field-level diff was not computed.
   */
  changed_fields?: string[];
  /** Server's user id / name that last modified the row, when known. */
  changed_by?: string;
  /** ISO timestamp of the server-side last modification. */
  changed_at?: string;
}

interface ResultBase {
  /** Server timestamp stamped on response build. ISO 8601. */
  received_at?: string;
}

export type SyncResult =
  | (ResultBase & {
      status: 'ok';
      client_op_id: string;
      server_id: string;
      version: number;
    })
  | (ResultBase & {
      status: 'duplicate';
      client_op_id: string;
      server_id: string;
      version: number;
    })
  | (ResultBase & {
      status: 'conflict';
      client_op_id: string;
      reason: string;
      server_state: Record<string, unknown>;
      conflict_context?: ConflictContext;
    })
  | (ResultBase & {
      status: 'rejected';
      client_op_id: string;
      reason: string;
    })
  | (ResultBase & {
      status: 'error';
      client_op_id: string;
      reason: string;
    });
