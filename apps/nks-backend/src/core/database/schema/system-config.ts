import { boolean, pgTable, text, unique, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { coreEntity, auditFields } from './base.entity';

export const systemConfig = pgTable(
  'system_config',
  {
    ...coreEntity(),

    key: varchar('key', { length: 128 }).notNull(),
    value: text('value').notNull(),
    description: varchar('description', { length: 500 }),
    isSecret: boolean('is_secret').default(false).notNull(),

    ...auditFields(() => users.id),
  },
  (table) => [unique('system_config_key_unique').on(table.key)],
);

export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
