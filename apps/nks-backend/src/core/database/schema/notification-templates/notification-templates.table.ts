import {
  pgTable,
  bigint,
  varchar,
  text,
  boolean,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coreEntity } from '../base.entity';
import { notificationTypes } from '../notification-types';
import { notificationTemplateStatusEnum } from '../enums';

/**
 * notification_templates — per-type, per-language title/body templates.
 *
 * Without this table, title and body are hardcoded in NestJS services:
 *   title: `Your order #${orderId} has been shipped`
 *
 * With this table, the service just does:
 *   template = findByTypeAndLanguage(typeCode, user.languagePreference)
 *   title    = render(template.titleTemplate, { orderId, status })
 *
 * Placeholders use {{variable}} syntax.
 * Example:
 *   titleTemplate: "Your order #{{orderId}} has been {{status}}"
 *   bodyTemplate:  "Estimated delivery: {{eta}}. Tap to track."
 *
 * status:
 *   DRAFT     → being authored, not yet visible to the delivery system
 *   PUBLISHED → live — exactly one allowed per (type, language)
 *   ARCHIVED  → replaced by a newer version, kept for audit history
 * isSystem  = true  → seeded default — cannot be deleted via admin UI
 */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    ...coreEntity(), // id, guuid, isActive, createdAt, updatedAt, deletedAt

    sortOrder: integer('sort_order'),
    isSystem: boolean('is_system').notNull().default(false),

    // Single source of truth for lifecycle state — replaces the contradictory isDraft + isActive pair.
    status: notificationTemplateStatusEnum('status').notNull().default('DRAFT'),

    typeFk: bigint('type_fk', { mode: 'number' })
      .notNull()
      .references(() => notificationTypes.id, { onDelete: 'cascade' }),

    language: varchar('language', { length: 5 }).notNull().default('en'), // 'en' | 'ta'

    titleTemplate: varchar('title_template', { length: 255 }).notNull(),
    bodyTemplate: text('body_template').notNull(),
  },
  (table) => [
    // Only one PUBLISHED template per type + language — enforces live uniqueness.
    uniqueIndex('notification_templates_published_idx')
      .on(table.typeFk, table.language)
      .where(sql`status = 'PUBLISHED' AND deleted_at IS NULL`),

    // Only one DRAFT per type + language — prevents silent accumulation of stale drafts.
    uniqueIndex('notification_templates_draft_idx')
      .on(table.typeFk, table.language)
      .where(sql`status = 'DRAFT' AND deleted_at IS NULL`),
  ],
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
