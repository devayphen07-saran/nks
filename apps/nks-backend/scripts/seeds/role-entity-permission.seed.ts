import { roleEntityPermission, roles } from '../../src/core/database/schema/index.js';
import { entityType } from '../../src/core/database/schema/lookups/entity-type/entity-type.table.js';
import type { Db } from './types.js';

/**
 * Seed role-entity permissions for all system and custom roles.
 *
 * Defines granular permissions per entity per role
 * System roles: SUPER_ADMIN, USER, STORE_OWNER (stored in roles table with storeFk = NULL)
 * Custom roles: STORE_MANAGER, CASHIER, DELIVERY
 *
 * Entities: users, store, contact_person, customers, suppliers,
 *           products, orders, purchase_orders, invoices
 *
 * System roles are created by migration 014_system_roles_as_records.sql during schema setup.
 * Custom roles are created via API after stores exist.
 */

// Permission shorthand
type Perms = { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
const ALL: Perms  = { canView: true,  canCreate: true,  canEdit: true,  canDelete: true };
const VIEW: Perms = { canView: true,  canCreate: false, canEdit: false, canDelete: false };

/**
 * Business domain permissions — entity codes must match entity-type.seed.ts.
 * Platform admin permissions are in role-entity-permission-admin.seed.ts.
 */
const PERMISSION_MATRIX: Record<string, Record<string, Perms>> = {
  // SUPER_ADMIN: bypassed by RBACGuard, seeded for completeness
  SUPER_ADMIN: {
    PRODUCT:        ALL,
    CUSTOMER:       ALL,
    VENDOR:         ALL,
    INVOICE:        ALL,
    PURCHASE_ORDER: ALL,
    TRANSACTION:    ALL,
    PAYMENT:        ALL,
    INVENTORY:      ALL,
    REPORT:         ALL,
  },

  // STORE_OWNER: Full access to business entities
  STORE_OWNER: {
    PRODUCT:        ALL,
    CUSTOMER:       ALL,
    VENDOR:         ALL,
    INVOICE:        ALL,
    PURCHASE_ORDER: ALL,
    TRANSACTION:    ALL,
    PAYMENT:        ALL,
    INVENTORY:      ALL,
    REPORT:         VIEW,
  },

};

export async function seedRoleEntityPermissions(db: Db) {
  // Step 1: Get all roles from roles table
  const allRoles = await db.select({ id: roles.id, code: roles.code }).from(roles);

  const rolesMap = new Map(allRoles.map((r) => [r.code, r.id]));

  // Step 2: Get all entity types from entity_type lookup table
  const allEntityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType);

  const entityTypesMap = new Map(allEntityTypes.map((et) => [et.code, et.id]));

  // Step 3: Build permissions to insert
  const permissionsToInsert = [];

  for (const [roleCode, permMatrix] of Object.entries(PERMISSION_MATRIX)) {
    const roleId = rolesMap.get(roleCode);
    if (!roleId) {
      console.warn(`Role "${roleCode}" not found in database, skipping permissions`);
      continue;
    }

    for (const [entityCode, entityPerms] of Object.entries(permMatrix)) {
      const entityTypeId = entityTypesMap.get(entityCode);
      if (!entityTypeId) {
        console.warn(
          `Entity type "${entityCode}" not found in entity_type table, skipping`,
        );
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
    console.warn('No permissions to seed (no roles found)');
    return { rowCount: 0 };
  }

  // Step 4: Insert permissions with onConflictDoNothing for idempotency
  // (Only inserts if role_fk + entity_type_fk doesn't exist)
  const result = await db
    .insert(roleEntityPermission)
    .values(permissionsToInsert)
    .onConflictDoNothing();

  console.log(`Seeded ${permissionsToInsert.length} role-entity permissions`);
  return result;
}
