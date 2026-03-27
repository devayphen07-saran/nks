import { roles, routes, roleRouteMapping } from '../../src/core/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from './types.js';

/**
 * Seeds role_route_mapping:
 *  - SUPER_ADMIN → all /admin/* routes (full CRUD access)
 *
 * Must run AFTER seedRoles and seedRoutes.
 */
export async function seedRoleRouteMappings(db: Db) {
  // 1. Resolve SUPER_ADMIN role
  const [superAdmin] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, 'SUPER_ADMIN'))
    .limit(1);

  if (!superAdmin) {
    throw new Error('SUPER_ADMIN role not found — seed roles first');
  }

  // 2. Get all admin routes (those with appCode = 'NKS_WEB')
  const adminRoutes = await db
    .select({ id: routes.id, routePath: routes.routePath })
    .from(routes)
    .where(
      and(
        eq(routes.appCode, 'NKS_WEB'),
        isNull(routes.deletedAt),
      ),
    );

  if (adminRoutes.length === 0) {
    throw new Error('No admin routes found — seed routes first');
  }

  // 3. Build mappings — SUPER_ADMIN gets full access to every admin route
  const mappings = adminRoutes.map((r) => ({
    roleFk: superAdmin.id,
    routeFk: r.id,
    allow: true,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
  }));

  return db
    .insert(roleRouteMapping)
    .values(mappings)
    .onConflictDoNothing(); // idempotent — safe to re-run
}
