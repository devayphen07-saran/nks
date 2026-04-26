import { bigint, index, pgTable, varchar } from 'drizzle-orm/pg-core';
import { coreEntity } from './base.entity';
import { users } from './auth/users';

export const files = pgTable(
  'files',
  {
    ...coreEntity(),

    // Polymorphic reference: which entity type + which record owns this file.
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),

    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileKey: varchar('file_key', { length: 500 }).notNull(), // S3 object key
    fileSize: bigint('file_size', { mode: 'number' }).notNull(), // bytes
    mimeType: varchar('mime_type', { length: 100 }),
    // Permanent public S3 URL stored at upload time.
    // Set to null on soft-delete (object moved to trash/ prefix in S3).
    fileUrl: varchar('file_url', { length: 500 }),

    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    modifiedBy: bigint('modified_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    deletedBy: bigint('deleted_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
  },
  (table) => [
    index('files_entity_idx').on(table.entityType, table.entityId),
    index('files_created_idx').on(table.createdAt),
    index('files_created_by_idx').on(table.createdBy),
  ],
);

export type Files = typeof files.$inferSelect;
export type NewFiles = typeof files.$inferInsert;
