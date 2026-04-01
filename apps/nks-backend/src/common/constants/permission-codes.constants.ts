/**
 * Typed permission code constants.
 *
 * Format: `resource.action` — matches the `code` column in the permissions table.
 * Use these in @RequirePermission() and anywhere else a permission code is needed
 * to avoid free-string typos that silently grant or deny access.
 *
 * Mirrors Java's PermissionKeyConstants.java pattern.
 *
 * @example
 * @RequirePermission(PermissionCodes.ORDERS_VIEW)
 * async listOrders() {}
 */
export const PermissionCodes = {
  // ── Users ────────────────────────────────────────────────────────────────
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_EXPORT: 'users.export',

  // ── Roles ────────────────────────────────────────────────────────────────
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT: 'roles.edit',
  ROLES_DELETE: 'roles.delete',

  // ── Store ────────────────────────────────────────────────────────────────
  STORE_VIEW: 'store.view',
  STORE_EDIT: 'store.edit',
  STORE_DELETE: 'store.delete',

  // ── Products ─────────────────────────────────────────────────────────────
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_EXPORT: 'products.export',

  // ── Orders ───────────────────────────────────────────────────────────────
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_EXPORT: 'orders.export',

  // ── Staff ────────────────────────────────────────────────────────────────
  STAFF_VIEW: 'staff.view',
  STAFF_INVITE: 'staff.invite',
  STAFF_EDIT: 'staff.edit',
  STAFF_REMOVE: 'staff.remove',

  // ── Customers ────────────────────────────────────────────────────────────
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_DELETE: 'customers.delete',
  CUSTOMERS_EXPORT: 'customers.export',

  // ── Reports / Analytics ──────────────────────────────────────────────────
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // ── Settings ─────────────────────────────────────────────────────────────
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',

  // ── Inventory ────────────────────────────────────────────────────────────
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_EDIT: 'inventory.edit',
  INVENTORY_EXPORT: 'inventory.export',

  // ── POS / Transactions ───────────────────────────────────────────────────
  POS_VIEW: 'pos.view',
  POS_CREATE: 'pos.create',
  POS_VOID: 'pos.void',

  // ── Deliveries ───────────────────────────────────────────────────────────
  DELIVERIES_VIEW: 'deliveries.view',
  DELIVERIES_EDIT: 'deliveries.edit',
} as const;

/** Union type of all valid permission code strings. */
export type PermissionCode =
  (typeof PermissionCodes)[keyof typeof PermissionCodes];
