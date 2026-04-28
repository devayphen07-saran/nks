/**
 * Initial compound cursor for pull sync.
 *
 * Format: "{updatedAt timestamp ms}:{row id}". Both zero means "fetch from
 * the beginning" — sent by clients on first sync after login or reset.
 *
 * Kept in sync with `sync-changes-query.dto.ts` default and the cursor
 * parser in `sync.service.ts`.
 */
export const INITIAL_SYNC_CURSOR = '0:0';

/**
 * Sync schema versions this server accepts.
 * Add new versions here when rolling out breaking protocol changes.
 * Remove old versions only after all clients have been force-updated.
 */
export const SUPPORTED_SYNC_SCHEMA_VERSIONS = new Set(['1']);

export const SYNC_SCHEMA_VERSION_HEADER = 'x-sync-schema-version';
