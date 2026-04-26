import { roles, entityType, permissionAction, rolePermissions } from '../../../src/core/database/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from '../types.js';

/**
 * Seeds role_permissions for STORE_OWNER with scoped access:
 *
 *  Business entities (INVOICE, PRODUCT, PURCHASE_ORDER, CUSTOMER, VENDOR,
 *  INVENTORY, TRANSACTION, PAYMENT) → all 7 actions
 *
 *  Store management (ROLE, USER, ROUTE, ENTITY_STATUS) → VIEW CREATE EDIT DELETE
 *
 *  Reference / platform read-only (CODE_CATEGORY, CODE_VALUE, STATUS,
 *  LOOKUP, SYNC, REPORT, AUDIT_LOG) → VIEW only
 *
 * Must run AFTER: system_roles, entity_type, permission_actions.
 * Idempotent — ON CONFLICT DO UPDATE resets allowed=true, deny=false.
 */

const BUSINESS_ENTITIES = [
  'ORDER', 'INVOICE', 'PRODUCT', 'PURCHASE_ORDER', 'CUSTOMER',
  'VENDOR', 'INVENTORY', 'TRANSACTION', 'PAYMENT',
];

const STORE_MGMT_ENTITIES = ['ROLE', 'USER', 'ROUTE', 'ENTITY_STATUS'];
const STORE_MGMT_ACTIONS  = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

const READONLY_ENTITIES   = [
  'CODE_CATEGORY', 'CODE_VALUE', 'STATUS', 'LOOKUP', 'SYNC', 'REPORT', 'AUDIT_LOG',
  'SUBSCRIPTION', 'BILLING',
];

export async function seedStoreOwnerPermissions(db: Db): Promise<{ rowCount: number }> {
  // ── 1. Resolve STORE_OWNER role ───────────────────────────────────────────
  const [storeOwnerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, 'STORE_OWNER'), isNull(roles.storeFk)))
    .limit(1);

  if (!storeOwnerRole) {
    throw new Error('STORE_OWNER role not found — run system_roles seed first.');
  }

  // ── 2. Resolve entity types ───────────────────────────────────────────────
  const entityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType)
    .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)));

  if (entityTypes.length === 0) {
    throw new Error('No entity types found — run entity_type seed first.');
  }

  const entityMap = new Map(entityTypes.map((e) => [e.code, e.id]));

  // ── 3. Resolve permission actions ─────────────────────────────────────────
  const actions = await db
    .select({ id: permissionAction.id, code: permissionAction.code })
    .from(permissionAction)
    .where(and(eq(permissionAction.isActive, true), isNull(permissionAction.deletedAt)));

  if (actions.length === 0) {
    throw new Error('No permission actions found — run permission_actions seed first.');
  }

  const actionMap = new Map(actions.map((a) => [a.code, a.id]));

  // ── 4. Build permission rows ───────────────────────────────────────────────
  const rows: typeof rolePermissions.$inferInsert[] = [];

  const push = (entityCode: string, actionCodes: string[]) => {
    const entityId = entityMap.get(entityCode);
    if (!entityId) return;
    for (const actionCode of actionCodes) {
      const actionId = actionMap.get(actionCode);
      if (!actionId) continue;
      rows.push({
        roleFk:       storeOwnerRole.id,
        entityTypeFk: entityId,
        actionFk:     actionId,
        allowed:      true,
        deny:         false,
        isActive:     true,
      });
    }
  };

  const ALL_ACTIONS = actions.map((a) => a.code);

  for (const code of BUSINESS_ENTITIES)    push(code, ALL_ACTIONS);
  for (const code of STORE_MGMT_ENTITIES)  push(code, STORE_MGMT_ACTIONS);
  for (const code of READONLY_ENTITIES)    push(code, ['VIEW']);

  if (rows.length === 0) return { rowCount: 0 };

  await db
    .insert(rolePermissions)
    .values(rows)
    .onConflictDoUpdate({
      target: [rolePermissions.roleFk, rolePermissions.entityTypeFk, rolePermissions.actionFk],
      set: { allowed: true, deny: false, isActive: true },
    });

  return { rowCount: rows.length };
}
