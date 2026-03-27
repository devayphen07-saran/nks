import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity } from '../base.entity';

// NOTE: switched from betterAuthEntity → baseEntity to get isSystem, sortOrder,
// isHidden, isActive, and deletedAt. A migration is required to add those columns.
export const permissions = pgTable('permissions', {
  ...baseEntity(),

  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 20 }).notNull(),
  description: text('description'),
});

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type UpdatePermission = Partial<Omit<NewPermission, 'id'>>;
