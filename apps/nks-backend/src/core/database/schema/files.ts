import {
  bigint,
  boolean,
  index,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const files = pgTable(
  'files',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // store, user, invoice, document, etc
    entityId: bigint('entity_id', { mode: 'number' }).notNull(), // polymorphic reference
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileKey: varchar('file_key', { length: 500 }).notNull(), // S3/Cloud storage key
    fileSize: bigint('file_size', { mode: 'number' }).notNull(), // bytes
    mimeType: varchar('mime_type', { length: 100 }),
    fileUrl: varchar('file_url', { length: 500 }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: bigint('deleted_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
  },
  (table) => ({
    entityIdx: index('files_entity_idx').on(table.entityType, table.entityId),
    createdIdx: index('files_created_idx').on(table.createdAt),
    createdByIdx: index('files_created_by_idx').on(table.createdBy),
  }),
);

export type Files = typeof files.$inferSelect;
export type NewFiles = typeof files.$inferInsert;
