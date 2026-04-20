import { roleEntityPermission, roles } from '../../src/core/database/schema/index.js';
import { entityType } from '../../src/core/database/schema/lookups/entity-type/entity-type.table.js';
import type { Db } from './types.js';

/**
 * Platform administration entity permissions.
 *
 * Separate from business domain permissions (role-entity-permission.seed.ts).
 * Entity codes must match entity-type.seed.ts.
 *
 * These control access to platform admin features:
 * codes, statuses, lookups, audit logs, users, roles, routes, sync.
 */

type Perms = { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
const ALL: Perms  = { canView: true,  canCreate: true,  canEdit: true,  canDelete: true };
const VIEW: Perms = { canView: true,  canCreate: false, canEdit: false, canDelete: false };

const PERMISSION_MATRIX: Record<string, Record<string, Perms>> = {
  // SUPER_ADMIN: bypassed by RBACGuard, seeded for completeness
  SUPER_ADMIN: {
    CODE_CATEGORY: ALL,
    CODE_VALUE:    ALL,
    STATUS:        ALL,
    LOOKUP:        ALL,
    AUDIT_LOG:     VIEW,
    USER:          ALL,
    ROLE:          ALL,
    ROUTE:         ALL,
    SYNC:          ALL,
  },

  // STORE_OWNER: read-only on platform admin, full access to role management
  STORE_OWNER: {
    CODE_CATEGORY: VIEW,
    CODE_VALUE:    VIEW,
    STATUS:        VIEW,
    LOOKUP:        VIEW,
    AUDIT_LOG:     VIEW,
    USER:          { canView: true, canCreate: true, canEdit: true, canDelete: false },
    ROLE:          ALL,
    ROUTE:         VIEW,
    SYNC:          { canView: true, canCreate: true, canEdit: false, canDelete: false },
  },

};

export async function seedRoleEntityPermissionsAdmin(db: Db) {
  const allRoles = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const rolesMap = new Map(allRoles.map((r) => [r.code, r.id]));

  const allEntityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType);
  const entityTypesMap = new Map(allEntityTypes.map((et) => [et.code, et.id]));

  const permissionsToInsert = [];

  for (const [roleCode, permMatrix] of Object.entries(PERMISSION_MATRIX)) {
    const roleId = rolesMap.get(roleCode);
    if (!roleId) {
      console.warn(`[admin-perms] Role "${roleCode}" not found, skipping`);
      continue;
    }

    for (const [entityCode, entityPerms] of Object.entries(permMatrix)) {
      const entityTypeId = entityTypesMap.get(entityCode);
      if (!entityTypeId) {
        console.warn(`[admin-perms] Entity type "${entityCode}" not found, skipping`);
        continue;
      }

      permissionsToInsert.push({
        roleFk: roleId,
        entityTypeFk: entityTypeId,
        canView: entityPerms.canView,
        canCreate: entityPerms.canCreate,
        canEdit: entityPerms.canEdit,
        canDelete: entityPerms.canDelete,
        isActive: true,
      });
    }
  }

  if (permissionsToInsert.length === 0) {
    console.warn('[admin-perms] No permissions to seed');
    return { rowCount: 0 };
  }

  const result = await db
    .insert(roleEntityPermission)
    .values(permissionsToInsert)
    .onConflictDoNothing();

  console.log(`[admin-perms] Seeded ${permissionsToInsert.length} platform admin permissions`);
  return result;
}
