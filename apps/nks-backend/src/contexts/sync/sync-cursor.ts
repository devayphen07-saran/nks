/**
 * Compound cursor helpers for pull sync.
 *
 * Wire format: "{updatedAt timestamp ms}:{row id}".
 * The id breaks ties when multiple rows share the same updated_at — without
 * it, pagination can skip or duplicate rows committed in the same millisecond.
 *
 * "0:0" (INITIAL_SYNC_CURSOR) means "fetch from the beginning".
 */

export function parseCursor(cursor: string): { ts: number; id: number } {
  const parts = cursor.split(':');
  if (parts.length !== 2) return { ts: 0, id: 0 };
  const ts = parseInt(parts[0], 10);
  const id = parseInt(parts[1], 10);
  if (isNaN(ts) || isNaN(id)) return { ts: 0, id: 0 };
  return { ts, id };
}

/** Build the next cursor from a result slice; returns fallback if empty. */
export function buildCursor(
  rows: Array<{ id: number; updatedAt: Date | null }>,
  fallback: string,
): string {
  if (rows.length === 0) return fallback;
  const last = rows[rows.length - 1];
  return `${(last.updatedAt ?? new Date(0)).getTime()}:${last.id}`;
}