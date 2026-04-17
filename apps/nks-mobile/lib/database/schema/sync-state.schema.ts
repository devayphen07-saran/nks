import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const syncState = sqliteTable('sync_state', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

export type SyncStateRow = typeof syncState.$inferSelect;
