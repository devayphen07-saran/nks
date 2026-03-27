import type { Db } from './types.js';
import { permissions } from '../../src/core/database/schema';

const data = [
  // Users
  { name: 'View Users',      code: 'users:read',      resource: 'users',    action: 'read',   isSystem: true },
  { name: 'Create Users',    code: 'users:create',    resource: 'users',    action: 'create', isSystem: true },
  { name: 'Update Users',    code: 'users:update',    resource: 'users',    action: 'update', isSystem: true },
  { name: 'Delete Users',    code: 'users:delete',    resource: 'users',    action: 'delete', isSystem: true },
  // Products
  { name: 'View Products',   code: 'products:read',   resource: 'products', action: 'read',   isSystem: true },
  { name: 'Create Products', code: 'products:create', resource: 'products', action: 'create', isSystem: true },
  { name: 'Update Products', code: 'products:update', resource: 'products', action: 'update', isSystem: true },
  { name: 'Delete Products', code: 'products:delete', resource: 'products', action: 'delete', isSystem: true },
  // Orders
  { name: 'View Orders',     code: 'orders:read',     resource: 'orders',   action: 'read',   isSystem: true },
  { name: 'Create Orders',   code: 'orders:create',   resource: 'orders',   action: 'create', isSystem: true },
  { name: 'Update Orders',   code: 'orders:update',   resource: 'orders',   action: 'update', isSystem: true },
  { name: 'Delete Orders',   code: 'orders:delete',   resource: 'orders',   action: 'delete', isSystem: true },
  // Company
  { name: 'View Company',    code: 'company:read',    resource: 'company',  action: 'read',   isSystem: true },
  { name: 'Create Company',  code: 'company:create',  resource: 'company',  action: 'create', isSystem: true },
  { name: 'Update Company',  code: 'company:update',  resource: 'company',  action: 'update', isSystem: true },
  { name: 'Delete Company',  code: 'company:delete',  resource: 'company',  action: 'delete', isSystem: true },
  // Reports
  { name: 'View Reports',    code: 'reports:read',    resource: 'reports',  action: 'read',   isSystem: true },
  // Settings
  { name: 'View Settings',   code: 'settings:read',   resource: 'settings', action: 'read',   isSystem: true },
  { name: 'Update Settings', code: 'settings:update', resource: 'settings', action: 'update', isSystem: true },
];

export async function seedPermissions(db: Db) {
  return db.insert(permissions).values(data).onConflictDoNothing();
}
