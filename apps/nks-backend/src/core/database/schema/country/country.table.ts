import { pgTable, varchar, char, integer, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

export const country = pgTable('country', {
  ...baseEntity(),

  countryName: varchar('country_name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 255 }),

  isoCode2: char('iso_code2', { length: 2 }).notNull().unique(), // IN, US

  dialCode: varchar('dial_code', { length: 10 }), // +91
  currencyCode: varchar('currency_code', { length: 10 }), // INR
  currencySymbol: varchar('currency_symbol', { length: 10 }), // ₹
  timezone: varchar('timezone', { length: 50 }), // Asia/Kolkata

  sortOrder: integer('sort_order').default(0),
  isHidden: boolean('is_hidden').notNull().default(false),

  ...auditFields(() => users.id),
});

export type Country = typeof country.$inferSelect;
export type NewCountry = typeof country.$inferInsert;
export type UpdateCountry = Partial<Omit<NewCountry, 'id'>>;
