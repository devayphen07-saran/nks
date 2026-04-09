import { roleEntityPermission, roles } from '../../src/core/database/schema';
import { entityType } from '../../src/core/database/schema/lookups/entity-type/entity-type.table';
import { eq } from 'drizzle-orm';
import type { Db } from './types.js';

/**
 * Seed role-entity permissions for all system and custom roles.
 *
 * Defines granular permissions per entity per role
 * System roles: SUPER_ADMIN, STORE_OWNER, STAFF (stored in roles table with storeFk = NULL)
 * Custom roles: STORE_MANAGER, CASHIER, DELIVERY
 *
 * Entities: users, store, contact_person, customers, suppliers,
 *           products, orders, purchase_orders, invoices
 *
 * System roles are created by migration 014_system_roles_as_records.sql during schema setup.
 * Custom roles are created via API after stores exist.
 */

// Permission matrix: role -> entity -> permissions
const PERMISSION_MATRIX = {
  // SUPER_ADMIN: Platform-wide administrator with full access to all entities
  SUPER_ADMIN: {
    users: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    store: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    contact_person: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    customers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    suppliers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    products: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    purchase_orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    invoices: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  },

  // STORE_OWNER: Full access to their store, except cannot delete store or users
  STORE_OWNER: {
    users: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    store: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    contact_person: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    customers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    suppliers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    products: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    purchase_orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    invoices: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  },

  // STAFF: Minimal access, view-only for store and customers by default
  // Actual access depends on custom role assignment via API
  STAFF: {
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    store: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    contact_person: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    customers: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    suppliers: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    products: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    orders: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    purchase_orders: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    invoices: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },

  // STORE_MANAGER: Full access to most entities except users/store deletion
  STORE_MANAGER: {
    users: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    store: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    contact_person: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    customers: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    suppliers: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    products: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    orders: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    purchase_orders: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    invoices: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  },

  // CASHIER: Limited to payment-related entities
  CASHIER: {
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    store: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    contact_person: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    customers: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    suppliers: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    orders: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    purchase_orders: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    invoices: { canView: true, canCreate: true, canEdit: false, canDelete: false }, // Can view & create invoices (payments)
  },

  // DELIVERY: Limited to orders and shipment tracking
  DELIVERY: {
    users: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    store: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    contact_person: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    customers: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    suppliers: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    orders: { canView: true, canCreate: false, canEdit: true, canDelete: false }, // Can update order status
    purchase_orders: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    invoices: { canView: true, canCreate: false, canEdit: false, canDelete: false }, // View only
  },
};

const ENTITIES = [
  'users',
  'store',
  'contact_person',
  'customers',
  'suppliers',
  'products',
  'orders',
  'purchase_orders',
  'invoices',
];

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

    for (const entityCode of ENTITIES) {
      const entityPerms = permMatrix[entityCode as keyof typeof permMatrix];
      if (!entityPerms) continue;

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
        isSystem: true,
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
