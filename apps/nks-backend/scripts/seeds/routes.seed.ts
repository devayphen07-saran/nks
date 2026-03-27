import { routes } from '../../src/core/database/schema';
import type { Db } from './types.js';

// ─── Store-level routes (STORE_OWNER, MANAGER, CASHIER, STAFF) ──────────────
// appCode is NULL — these routes are shared across platform apps / no specific app target
const storeRoutes: (typeof routes.$inferInsert)[] = [
  { routeName: 'Dashboard',       routePath: '/dashboard',        fullPath: '/dashboard',        iconName: 'LayoutDashboard', routeType: 'sidebar', sortOrder: 1,  isSystem: true, appCode: null },
  { routeName: 'POS',             routePath: '/pos',              fullPath: '/pos',              iconName: 'ShoppingCart',    routeType: 'sidebar', sortOrder: 2,  isSystem: true, appCode: null },
  { routeName: 'Orders',          routePath: '/orders',           fullPath: '/orders',           iconName: 'ClipboardList',   routeType: 'sidebar', sortOrder: 3,  isSystem: true, appCode: null },
  { routeName: 'Products',        routePath: '/products',         fullPath: '/products',         iconName: 'Package',         routeType: 'sidebar', sortOrder: 4,  isSystem: true, appCode: null },
  { routeName: 'Customers',       routePath: '/customers',        fullPath: '/customers',        iconName: 'Users',           routeType: 'sidebar', sortOrder: 5,  isSystem: true, appCode: null },
  { routeName: 'Suppliers',       routePath: '/suppliers',        fullPath: '/suppliers',        iconName: 'Truck',           routeType: 'sidebar', sortOrder: 6,  isSystem: true, appCode: null },
  { routeName: 'Inventory',       routePath: '/inventory',        fullPath: '/inventory',        iconName: 'Warehouse',       routeType: 'sidebar', sortOrder: 7,  isSystem: true, appCode: null },
  { routeName: 'Reports',         routePath: '/reports',          fullPath: '/reports',          iconName: 'BarChart3',       routeType: 'sidebar', sortOrder: 8,  isSystem: true, appCode: null },
  { routeName: 'Settings',        routePath: '/settings',         fullPath: '/settings',         iconName: 'Settings',        routeType: 'sidebar', sortOrder: 9,  isSystem: true, appCode: null },
  { routeName: 'User Management', routePath: '/user-management',  fullPath: '/user-management',  iconName: 'Shield',          routeType: 'sidebar', sortOrder: 10, isSystem: true, appCode: null },
];

// ─── Software Company / Super Admin routes (SUPER_ADMIN only) ───────────────
// appCode = 'NKS_WEB' — these routes belong to the central admin portal
const adminRoutes: (typeof routes.$inferInsert)[] = [
  { routeName: 'Platform Dashboard', routePath: '/admin/dashboard',       fullPath: '/admin/dashboard',       iconName: 'LayoutDashboard', routeType: 'sidebar', sortOrder: 10, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Overview of the entire NKS multi-store ecosystem' },
  { routeName: 'Organizations',      routePath: '/admin/stores',          fullPath: '/admin/stores',          iconName: 'Store',           routeType: 'sidebar', sortOrder: 20, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Manage and monitor all business entities on the platform' },
  { routeName: 'Users & Staff',      routePath: '/admin/users',           fullPath: '/admin/users',           iconName: 'Users',           routeType: 'sidebar', sortOrder: 30, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Global user directory and platform-wide staff management' },
  { routeName: 'Billing',            routePath: '/admin/billing',         fullPath: '/admin/billing',         iconName: 'CreditCard',      routeType: 'sidebar', sortOrder: 40, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Track platform-wide revenue and store invoicing' },
  { routeName: 'Subscriptions',      routePath: '/admin/subscriptions',   fullPath: '/admin/subscriptions',   iconName: 'Package',         routeType: 'sidebar', sortOrder: 50, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Define and manage commercial subscription tiers for businesses' },
  { routeName: 'System Health',      routePath: '/admin/system-settings', fullPath: '/admin/system-settings', iconName: 'Activity',        routeType: 'sidebar', sortOrder: 60, isSystem: true, appCode: 'NKS_WEB', isPublic: false, description: 'Monitor platform infrastructure and manage system configurations' },
];

export async function seedRoutes(db: Db) {
  return db
    .insert(routes)
    .values([...storeRoutes, ...adminRoutes])
    .onConflictDoNothing();
}
