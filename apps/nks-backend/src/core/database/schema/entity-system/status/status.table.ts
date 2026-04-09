import { pgTable, varchar, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

export const status = pgTable('status', {
  ...baseEntity(),

  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  description: varchar('description', { length: 100 }),

  // Visual styling — admin-configurable badge appearance
  fontColor: varchar('font_color', { length: 7 }), // e.g. "#FFFFFF"
  bgColor: varchar('bg_color', { length: 7 }), // e.g. "#28A745"
  borderColor: varchar('border_color', { length: 7 }), // e.g. "#1E7E34"
  isBold: boolean('is_bold').notNull().default(false),

  ...auditFields(() => users.id),
});

export type Status = typeof status.$inferSelect;
export type NewStatus = typeof status.$inferInsert;
export type UpdateStatus = Partial<Omit<NewStatus, 'id'>>;
