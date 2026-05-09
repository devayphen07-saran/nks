/**
 * Entity Names — polymorphic ownership discriminator.
 *
 * The `entity` table is the polymorphic registry referenced by `address.entity_fk`,
 * `communication.entity_fk`, `files.entity_fk`, `notes.entity_fk`, etc. Each row
 * has a unique `entity_name` (e.g. 'store', 'customers', 'products').
 *
 * Use these constants when writing queries that filter by entity ownership.
 * The numeric `entity.id` is resolved from these strings at runtime by
 * `EntityRegistryService` (cached on app start; the `entity` table is static).
 *
 * NOT to be confused with `EntityCodes` in `entity-codes.constants.ts` — those
 * are RBAC permission codes (`entity_type.code`), a separate registry.
 *
 * Source of truth: `scripts/seeds/iam/data/entities.ts`. Adding a new entity
 * requires both a seed entry and a constant here.
 */
export const EntityNames = {
  USERS:           'users',
  STORE:           'store',
  CONTACT_PERSON:  'contact_person',
  CUSTOMERS:       'customers',
  SUPPLIERS:       'suppliers',
  PRODUCTS:        'products',
  ORDERS:          'orders',
  PURCHASE_ORDERS: 'purchase_orders',
  INVOICES:        'invoices',
} as const;

export type EntityName = (typeof EntityNames)[keyof typeof EntityNames];
