import {
  pgTable,
  varchar,
  bigint,
  boolean,
  check,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { routeTypeEnum, routeScopeEnum } from '../../enums';
import { entityType } from '../../lookups/entity-type';

export const routes = pgTable(
  'routes',
  {
    ...baseEntity(),

    // onDelete: 'set null' — when a parent route is deleted, children become root-level routes.
    // This is intentional: child screens remain navigable rather than being cascade-deleted.
    // Application code should re-parent or re-seed orphaned children after a parent deletion.
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

    routeScope: routeScopeEnum('route_scope').notNull().default('admin'),

    // Public routes (login, onboarding, accept-invite) skip the auth guard.
    // Without this flag the guard must maintain a hardcoded whitelist.
    isPublic: boolean('is_public').notNull().default(false),

    // Admin-controlled soft-disable: hides the route from navigation without
    // deleting it (is_active = false is a soft delete; enable = false is a toggle).
    enable: boolean('enable').notNull().default(true),

    // Dynamic permission binding — links this route to an entity type so the
    // RoutesService can filter the navigation tree by the user's permissions
    // without hardcoding entity codes in service logic.
    // NULL for routes that are always visible (public routes, structural dividers).
    entityTypeFk: bigint('entity_type_fk', { mode: 'number' }).references(
      () => entityType.id,
      { onDelete: 'set null' },
    ),

    // Which action must be allowed on entityTypeFk for this route to appear.
    // Defaults to 'view' — override to 'create' for new-record routes, etc.
    // Ignored when entityTypeFk is NULL.
    defaultAction: varchar('default_action', { length: 50 }).default('view'),

    ...auditFields(() => users.id),
  },
  (table) => [
    uniqueIndex('routes_path_scope_idx')
      .on(table.routePath, table.routeScope)
      .where(sql`deleted_at IS NULL`),
    index('routes_entity_type_idx')
      .on(table.entityTypeFk)
      .where(sql`entity_type_fk IS NOT NULL AND deleted_at IS NULL`),
    // Tree traversal — find children of a given parent route.
    index('routes_parent_route_fk_idx')
      .on(table.parentRouteFk)
      .where(sql`parent_route_fk IS NOT NULL`),
    // A deleted route must be disabled. Prevents a soft-deleted route from
    // remaining "enabled" and leaking into navigation queries.
    check(
      'routes_deleted_must_be_disabled',
      sql`NOT (deleted_at IS NOT NULL AND enable = true)`,
    ),
  ],
);

export type Route = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;
export type UpdateRoute = Partial<Omit<NewRoute, 'id'>>;
