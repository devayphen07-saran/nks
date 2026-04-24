import { roles, entityType, permissionAction, rolePermissions } from '../../src/core/database/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from './types.js';

/**
 * Seeds role_permissions for SUPER_ADMIN across every entity type × action.
 *
 * Must run AFTER: system_roles, entity_type, permission_actions.
 *
 * Idempotent — ON CONFLICT DO UPDATE enforces allowed=true, deny=false even if
 * rows were previously written with incorrect values.
 */
export async function seedSuperAdminPermissions(db: Db): Promise<{ rowCount: number }> {
  // 1. Resolve SUPER_ADMIN role ID
  const [superAdminRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, 'SUPER_ADMIN'), isNull(roles.storeFk)))
    .limit(1);

  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found — run system_roles seed first.');
  }

  // 2. Fetch all active entity types
  const entityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType)
    .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)));

  if (entityTypes.length === 0) {
    throw new Error('No entity types found — run entity_type seed first.');
  }

  // 3. Fetch all active permission actions
  const actions = await db
    .select({ id: permissionAction.id, code: permissionAction.code })
    .from(permissionAction)
    .where(and(eq(permissionAction.isActive, true), isNull(permissionAction.deletedAt)));

  if (actions.length === 0) {
    throw new Error('No permission actions found — run permission_actions seed first.');
  }

  // 4. Build one row per (entity × action)
  const rows: typeof rolePermissions.$inferInsert[] = [];
  for (const et of entityTypes) {
    for (const action of actions) {
      rows.push({
        roleFk:       superAdminRole.id,
        entityTypeFk: et.id,
        actionFk:     action.id,
        allowed:      true,
        deny:         false,
        isActive:     true,
      });
    }
  }

  if (rows.length === 0) return { rowCount: 0 };

  // 5. Upsert — guarantees allowed=true, deny=false on every re-run
  await db
    .insert(rolePermissions)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        rolePermissions.roleFk,
        rolePermissions.entityTypeFk,
        rolePermissions.actionFk,
      ],
      set: {
        allowed:  true,
        deny:     false,
        isActive: true,
      },
    });

  return { rowCount: rows.length };
}
