import { integer, text } from 'drizzle-orm/pg-core';

/**
 * syncColumns — the standard column set every syncable domain table must
 * include. Spread into a pgTable definition with `...syncColumns()`.
 *
 *   version
 *     Incremented on every write. Drives optimistic concurrency: the mobile
 *     client sends `expected_version` in update/delete payloads, and the
 *     backend rejects with `conflict` if it doesn't match.
 *
 *   createdByDevice
 *     Stable device UUID for rows originated by mobile. NULL for web-
 *     originated rows. Attribution only — not a foreign key, because the
 *     device row may not exist yet during first login.
 *
 * "Who last modified this row" is already covered by auditFields.modifiedBy
 * (bigint FK → users.id). Don't add a second column for the same purpose.
 *
 * Each syncable table also needs a compound index on (updated_at ASC, id ASC).
 * That index is added in the table's migration; index syntax is per-table so
 * it can't live in this helper.
 */
export const syncColumns = () => ({
  version: integer('version').notNull().default(1),
  createdByDevice: text('created_by_device'),
});
