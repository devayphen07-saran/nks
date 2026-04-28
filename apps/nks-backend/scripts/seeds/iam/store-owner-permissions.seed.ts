import { roles, entityType, rolePermissions } from '../../../src/core/database/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from '../types.js';

/**
 * Seeds role_permissions for STORE_OWNER — one row per entity.
 *
 *  Business entities → canView + canCreate + canEdit + canDelete
 *  Store management  → canView + canCreate + canEdit + canDelete
 *  Reference/read-only → canView only
 *
 * Must run AFTER: system_roles, entity_type.
 */

const FULL_ACCESS_ENTITIES = [
  'ORDER', 'INVOICE', 'PRODUCT', 'PURCHASE_ORDER', 'CUSTOMER',
  'VENDOR', 'INVENTORY', 'TRANSACTION', 'PAYMENT',
  'ROLE', 'USER', 'ROUTE', 'ENTITY_STATUS',
];

const READONLY_ENTITIES = [
  'CODE_CATEGORY', 'CODE_VALUE', 'STATUS', 'LOOKUP', 'SYNC', 'REPORT', 'AUDIT_LOG',
  'SUBSCRIPTION', 'BILLING',
];

export async function seedStoreOwnerPermissions(db: Db): Promise<{ rowCount: number }> {
  const [storeOwnerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, 'STORE_OWNER'), isNull(roles.storeFk)))
    .limit(1);

  if (!storeOwnerRole) {
    throw new Error('STORE_OWNER role not found — run system_roles seed first.');
  }

  const entityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType)
    .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)));

  if (entityTypes.length === 0) {
    throw new Error('No entity types found — run entity_type seed first.');
  }

  const entityMap = new Map(entityTypes.map((e) => [e.code, e.id]));

  const rows: typeof rolePermissions.$inferInsert[] = [];

  for (const code of FULL_ACCESS_ENTITIES) {
    const entityId = entityMap.get(code);
    if (!entityId) continue;
    rows.push({
      roleFk:       storeOwnerRole.id,
      entityTypeFk: entityId,
      allow:        true,
      canView:      true,
      canCreate:    true,
      canEdit:      true,
      canDelete:    true,
      deny:         false,
      isActive:     true,
    });
  }

  for (const code of READONLY_ENTITIES) {
    const entityId = entityMap.get(code);
    if (!entityId) continue;
    rows.push({
      roleFk:       storeOwnerRole.id,
      entityTypeFk: entityId,
      allow:        true,
      canView:      true,
      canCreate:    false,
      canEdit:      false,
      canDelete:    false,
      deny:         false,
      isActive:     true,
    });
  }

  if (rows.length === 0) return { rowCount: 0 };

  await db
    .insert(rolePermissions)
    .values(rows)
    .onConflictDoUpdate({
      target: [rolePermissions.roleFk, rolePermissions.entityTypeFk],
      set: {
        allow:     true,
        canView:   rolePermissions.canView,
        canCreate: rolePermissions.canCreate,
        canEdit:   rolePermissions.canEdit,
        canDelete: rolePermissions.canDelete,
        deny:      false,
        isActive:  true,
      },
    });

  return { rowCount: rows.length };
}
