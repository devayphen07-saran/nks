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
