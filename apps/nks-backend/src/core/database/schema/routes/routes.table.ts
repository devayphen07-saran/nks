import {
  pgTable,
  varchar,
  bigint,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { routeTypeEnum } from '../enums';

export const routes = pgTable(
  'routes',
  {
    ...baseEntity(),

    parentRouteFk: bigint('parent_route_fk', { mode: 'number' }).references(
      (): AnyPgColumn => routes.id,
      { onDelete: 'set null' },
    ),

    routeName: varchar('route_name', { length: 100 }).notNull(),
    routePath: varchar('route_path', { length: 200 }).notNull(),
    fullPath: varchar('full_path', { length: 400 }).notNull().default(''),
    description: varchar('description', { length: 255 }),

    // Nullable — modal screens, deep-link pages, and settings sub-pages don't have nav icons.
    iconName: varchar('icon_name', { length: 80 }),

    // Enum-enforced. Default 'screen' — neutral for any platform.
    // sidebar: desktop nav item  |  tab: mobile bottom tab
    // screen:  navigable page    |  modal: overlay / sheet
    routeType: routeTypeEnum('route_type').notNull().default('screen'),

    appCode: varchar('app_code', { length: 50 }),

    // Public routes (login, onboarding, accept-invite) skip the auth guard.
    // Without this flag the guard must maintain a hardcoded whitelist.
    isPublic: boolean('is_public').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Prevent the same screen from being seeded twice for the same app.
    // appCode IS NULL rows (global routes) are excluded — duplicates there are caught at seed time.
    uniqueIndex('routes_path_app_idx')
      .on(table.routePath, table.appCode)
      .where(sql`app_code IS NOT NULL AND deleted_at IS NULL`),
  ],
);

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;
export type UpdateRoute = Partial<Omit<NewRoute, 'id'>>;
