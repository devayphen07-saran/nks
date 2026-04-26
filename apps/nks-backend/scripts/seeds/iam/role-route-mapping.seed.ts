import type { Db } from '../types.js';
import { roles, routes, roleRouteMapping } from '../../../src/core/database/schema/index.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';

/**
 * Seeds role_route_mapping:
 *  - SUPER_ADMIN → all admin routes (routeScope = 'admin')
 *  - STORE_OWNER → all store routes (routeScope = 'store')
 *
 * Must run AFTER seedRoutes and seedSystemRoles.
 */
export async function seedRoleRouteMappings(db: Db) {
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
    throw new Error('System roles not found — run system_roles seed first.');
  }

  const roleMap = new Map(systemRoles.map((r) => [r.code, r.id]));
  const superAdminId = roleMap.get('SUPER_ADMIN');
  const storeOwnerId = roleMap.get('STORE_OWNER');

  const mappings: typeof roleRouteMapping.$inferInsert[] = [];

  const adminRoutes = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.routeScope, 'admin'), isNull(routes.deletedAt)));

  if (adminRoutes.length === 0) {
    throw new Error('No admin routes found — run routes seed first.');
  }

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

  const storeRoutes = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.routeScope, 'store'), isNull(routes.deletedAt)));

  if (storeRoutes.length === 0) {
    throw new Error('No store routes found — run routes seed first.');
  }

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

  if (mappings.length === 0) return { rowCount: 0 };

  return db.insert(roleRouteMapping).values(mappings).onConflictDoNothing();
}
