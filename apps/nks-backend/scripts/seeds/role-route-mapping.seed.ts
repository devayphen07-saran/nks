import { roles, routes, roleRouteMapping } from '../../src/core/database/schema/index.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { Db } from './types.js';

/**
 * Seeds role_route_mapping:
 *  - SUPER_ADMIN → all admin routes (routeScope = 'admin') — full CRUD access
 *  - STORE_OWNER → all store routes (routeScope = 'store') — full CRUD access
 *
 * System roles are stored in the roles table with storeFk = NULL and is_editable = false.
 * They are created by the migration (014_system_roles_as_records.sql) before seeding.
 *
 * Must run AFTER seedRoutes. The migration handles system role creation.
 */
export async function seedRoleRouteMappings(db: Db) {
  // 1. Resolve system role IDs (storeFk IS NULL)
  const systemRoles = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(
      and(
        inArray(roles.code, ['SUPER_ADMIN', 'STORE_OWNER']),
        isNull(roles.storeFk),
      ),
    );

  if (systemRoles.length === 0) {
    throw new Error(
      'System roles not found in database. Migration 014_system_roles_as_records.sql may not have run.',
    );
  }

  const roleMap = new Map(systemRoles.map((r) => [r.code, r.id]));
  const superAdminId = roleMap.get('SUPER_ADMIN');
  const storeOwnerId = roleMap.get('STORE_OWNER');

  const mappings: typeof roleRouteMapping.$inferInsert[] = [];

  // 2. Get all admin routes (routeScope = 'admin')
  const adminRoutes = await db
    .select({ id: routes.id })
    .from(routes)
    .where(
      and(
        eq(routes.routeScope, 'admin'),
        isNull(routes.deletedAt),
      ),
    );

  if (adminRoutes.length === 0) {
    throw new Error('No admin routes found — seed routes first');
  }

  // 3. SUPER_ADMIN → all admin routes (full CRUD)
  if (superAdminId) {
    mappings.push(
      ...adminRoutes.map((r) => ({
        roleFk: superAdminId,
        routeFk: r.id,
        allow: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      })),
    );
  }

  // 4. Get all store routes (routeScope = 'store')
  const storeRoutes = await db
    .select({ id: routes.id })
    .from(routes)
    .where(
      and(
        eq(routes.routeScope, 'store'),
        isNull(routes.deletedAt),
      ),
    );

  if (storeRoutes.length === 0) {
    throw new Error('No store routes found — seed routes first');
  }

  // 5. STORE_OWNER → all store routes (full CRUD)
  if (storeOwnerId) {
    mappings.push(
      ...storeRoutes.map((r) => ({
        roleFk: storeOwnerId,
        routeFk: r.id,
        allow: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      })),
    );
  }

  if (mappings.length === 0) {
    return { rowCount: 0 };
  }

  return db
    .insert(roleRouteMapping)
    .values(mappings)
    .onConflictDoNothing(); // idempotent — safe to re-run
}
