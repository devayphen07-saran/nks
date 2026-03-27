import { roles, permissions, rolePermissionMapping } from '../../src/core/database/schema';
import { eq } from 'drizzle-orm';
import type { Db } from './types.js';

/**
 * Seeds role_permission_mapping by granting ALL permissions to SUPER_ADMIN.
 * Must run AFTER roles and permissions have been seeded.
 */
export async function seedRolePermissionMappings(db: Db) {
  // 1. Find SUPER_ADMIN role
  const [superAdmin] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, 'SUPER_ADMIN'))
    .limit(1);

  if (!superAdmin) {
    throw new Error('SUPER_ADMIN role not found — seed roles first');
  }

  // 2. Get all permissions
  const allPermissions = await db
    .select({ id: permissions.id })
    .from(permissions);

  if (allPermissions.length === 0) {
    throw new Error('No permissions found — seed permissions first');
  }

  // 3. Map every permission to SUPER_ADMIN
  const mappings = allPermissions.map((p) => ({
    roleFk: superAdmin.id,
    permissionFk: p.id,
  }));

  return db
    .insert(rolePermissionMapping)
    .values(mappings)
    .onConflictDoNothing();
}
