import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const entity = pgTable('entity', {
  ...baseEntity(),

  entityName: varchar('entity_name', { length: 100 }).notNull().unique(), // e.g. 'users', 'customers'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type Entity = typeof entity.$inferSelect;
export type NewEntity = typeof entity.$inferInsert;
export type UpdateEntity = Partial<Omit<NewEntity, 'id'>>;
