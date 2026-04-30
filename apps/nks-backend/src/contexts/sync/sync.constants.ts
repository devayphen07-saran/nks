import { ConflictException } from '@nestjs/common';

/**
 * Initial compound cursor for pull sync.
 *
 * Format: "{updatedAt timestamp ms}:{row id}". Both zero means "fetch from
 * the beginning" — used by clients on first sync after login, on full
 * resync, or whenever the local cursor cannot be trusted.
 *
 * Kept in sync with `sync-changes-query.dto.ts` default and the cursor
 * parser in `sync.service.ts`.
 *
 * ─── Full resync / reset contract (mobile responsibility) ─────────────────
 *
 * The mobile client MUST reset its per-table cursors to `INITIAL_SYNC_CURSOR`
 * AND wipe its local sync tables in any of these situations:
 *
 *   1. **Logout**: cursors and synced data belong to the previous user's
 *      authorization scope. Clear them so the next user does not inherit
 *      a stale snapshot. The client should also clear `last_pulled_at` /
 *      `last_pushed_at`.
 *
 *   2. **Local DB corruption / migration failure**: if mobile cannot trust
 *      its local state, it must restart from "0:0" rather than risk
 *      reconciling against partial data.
 *
 *   3. **Schema version bump**: when the server returns `409 Conflict` to a
 *      pull/push because `x-sync-schema-version` is unsupported, the client
 *      must upgrade itself, then wipe local sync tables and re-pull from
 *      "0:0". Resuming with old cursors after an app upgrade can deliver
 *      rows whose new fields are absent from local schemas.
 *
 *   4. **Switching active store**: per-table cursors are scoped to a
 *      `(userId, storeGuuid)` pair (the server's `verifyStoreMembership`
 *      gate enforces this). Switching stores must reset cursors so the
 *      new store's data is not blended with the previous one.
 *
 * The server has no equivalent "reset session" endpoint by design — full
 * resync is purely a client-side decision. Sending "0:0" is always safe
 * (server returns from the beginning); the cost is bandwidth + battery,
 * not correctness.
 */
export const INITIAL_SYNC_CURSOR = '0:0';

/**
 * Sync schema versions this server accepts.
 * Add new versions here when rolling out breaking protocol changes.
 * Remove old versions only after all clients have been force-updated.
 *
 * Bumping this is a breaking change — old clients receive `409 Conflict`
 * and must upgrade. After upgrade they should treat their local cursors
 * as untrusted (see INITIAL_SYNC_CURSOR docs above).
 */
export const SUPPORTED_SYNC_SCHEMA_VERSIONS = new Set(['1']);

export const SYNC_SCHEMA_VERSION_HEADER = 'x-sync-schema-version';

/**
 * Asserts the request's `x-sync-schema-version` header is one this server
 * accepts. Throws `ConflictException` (HTTP 409) on mismatch — clients that
 * receive 409 must upgrade and reset cursors per the contract above.
 *
 * Lives next to the constant so the validation rule is co-located with the
 * source of truth. Imported by SyncController and called at the top of every
 * sync endpoint.
 */
export function assertSupportedSchemaVersion(version: string | undefined): void {
  const v = version?.trim() ?? '';
  if (!SUPPORTED_SYNC_SCHEMA_VERSIONS.has(v)) {
    throw new ConflictException(
      `Unsupported sync schema version "${v}". ` +
      `Supported: [${[...SUPPORTED_SYNC_SCHEMA_VERSIONS].join(', ')}]. Please update the app.`,
    );
  }
}
