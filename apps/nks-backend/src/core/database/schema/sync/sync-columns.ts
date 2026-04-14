import { integer } from 'drizzle-orm/pg-core';

/**
 * Sync columns for offline-sync-compatible tables.
 *
 * Add these to any table that needs to sync with the mobile app.
 * The `coreEntity` base already provides `updatedAt` and `deletedAt`.
 * This adds `version` for optimistic concurrency control.
 *
 * Per-field timestamps (e.g. `name_updatedAt`, `status_updatedAt`)
 * should be added directly to each table as needed — they are
 * domain-specific and cannot be generalized.
 *
 * Usage:
 *   export const deliveryRoutes = pgTable('delivery_routes', {
 *     ...coreEntity(),
 *     ...syncColumns(),
 *     name: text('name').notNull(),
 *     // Per-field timestamps for conflict resolution:
 *     name_updatedAt: timestamp('name_updated_at', { withTimezone: true }),
 *   });
 *
 * SQL trigger (add per table via migration):
 *   CREATE OR REPLACE FUNCTION bump_<table>_version()
 *   RETURNS TRIGGER AS $$
 *   BEGIN
 *     NEW.updated_at = NOW();
 *     NEW.version = OLD.version + 1;
 *     RETURN NEW;
 *   END;
 *   $$ LANGUAGE plpgsql;
 */
export const syncColumns = () => ({
  version: integer('version').notNull().default(1),
});
