import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../../core/database/schema';

/**
 * Seed default permissions
 * Run once after database setup
 */
export async function seedPermissions(db: NodePgDatabase<typeof schema>) {
  const permissions: Array<typeof schema.permissions.$inferInsert> = [
    // Customers Module
    {
      code: 'customers.view',
      name: 'View Customers',
      resource: 'customers',
      action: 'view',
      description: 'View customer list and details',
    },
    {
      code: 'customers.create',
      name: 'Create Customer',
      resource: 'customers',
      action: 'create',
      description: 'Create new customers',
    },
    {
      code: 'customers.edit',
      name: 'Edit Customer',
      resource: 'customers',
      action: 'edit',
      description: 'Edit customer information',
    },
    {
      code: 'customers.delete',
      name: 'Delete Customer',
      resource: 'customers',
      action: 'delete',
      description: 'Delete customers',
    },
    {
      code: 'customers.view_reports',
      name: 'View Customer Reports',
      resource: 'customers',
      action: 'view_reports',
      description: 'View customer analytics and reports',
    },

    // Suppliers Module
    {
      code: 'suppliers.view',
      name: 'View Suppliers',
      resource: 'suppliers',
      action: 'view',
      description: 'View supplier list and details',
    },
    {
      code: 'suppliers.create',
      name: 'Create Supplier',
      resource: 'suppliers',
      action: 'create',
      description: 'Create new suppliers',
    },
    {
      code: 'suppliers.edit',
      name: 'Edit Supplier',
      resource: 'suppliers',
      action: 'edit',
      description: 'Edit supplier information',
    },
    {
      code: 'suppliers.delete',
      name: 'Delete Supplier',
      resource: 'suppliers',
      action: 'delete',
      description: 'Delete suppliers',
    },
    {
      code: 'suppliers.view_reports',
      name: 'View Supplier Reports',
      resource: 'suppliers',
      action: 'view_reports',
      description: 'View supplier analytics and reports',
    },

    // Products Module
    {
      code: 'products.view',
      name: 'View Products',
      resource: 'products',
      action: 'view',
      description: 'View product catalog',
    },
    {
      code: 'products.create',
      name: 'Create Product',
      resource: 'products',
      action: 'create',
      description: 'Create new products',
    },
    {
      code: 'products.edit',
      name: 'Edit Product',
      resource: 'products',
      action: 'edit',
      description: 'Edit product information',
    },
    {
      code: 'products.delete',
      name: 'Delete Product',
      resource: 'products',
      action: 'delete',
      description: 'Delete products',
    },
    {
      code: 'products.manage_pricing',
      name: 'Manage Product Pricing',
      resource: 'products',
      action: 'manage_pricing',
      description: 'Manage product prices and discounts',
    },

    // Orders Module
    {
      code: 'orders.view',
      name: 'View Orders',
      resource: 'orders',
      action: 'view',
      description: 'View order list and details',
    },
    {
      code: 'orders.create',
      name: 'Create Order',
      resource: 'orders',
      action: 'create',
      description: 'Create new orders',
    },
    {
      code: 'orders.edit',
      name: 'Edit Order',
      resource: 'orders',
      action: 'edit',
      description: 'Edit order details',
    },
    {
      code: 'orders.cancel',
      name: 'Cancel Order',
      resource: 'orders',
      action: 'cancel',
      description: 'Cancel orders',
    },

    // Invoices Module
    {
      code: 'invoices.view',
      name: 'View Invoices',
      resource: 'invoices',
      action: 'view',
      description: 'View invoice list and details',
    },
    {
      code: 'invoices.create',
      name: 'Create Invoice',
      resource: 'invoices',
      action: 'create',
      description: 'Create new invoices',
    },
    {
      code: 'invoices.edit',
      name: 'Edit Invoice',
      resource: 'invoices',
      action: 'edit',
      description: 'Edit invoice details',
    },
    {
      code: 'invoices.send',
      name: 'Send Invoice',
      resource: 'invoices',
      action: 'send',
      description: 'Send invoices to customers',
    },
    {
      code: 'invoices.mark_paid',
      name: 'Mark Invoice Paid',
      resource: 'invoices',
      action: 'mark_paid',
      description: 'Mark invoices as paid',
    },

    // Accounting Module
    {
      code: 'accounting.view',
      name: 'View Accounting',
      resource: 'accounting',
      action: 'view',
      description: 'View accounting data and ledgers',
    },
    {
      code: 'accounting.create_entry',
      name: 'Create Journal Entry',
      resource: 'accounting',
      action: 'create_entry',
      description: 'Create journal entries',
    },
    {
      code: 'accounting.approve_entry',
      name: 'Approve Journal Entry',
      resource: 'accounting',
      action: 'approve_entry',
      description: 'Approve journal entries',
    },
    {
      code: 'accounting.view_reports',
      name: 'View Accounting Reports',
      resource: 'accounting',
      action: 'view_reports',
      description: 'View financial reports (P&L, Balance Sheet, etc.)',
    },
    {
      code: 'accounting.export_reports',
      name: 'Export Accounting Reports',
      resource: 'accounting',
      action: 'export_reports',
      description: 'Export financial reports to PDF/Excel',
    },

    // Reports Module
    {
      code: 'reports.view',
      name: 'View Reports',
      resource: 'reports',
      action: 'view',
      description: 'View all reports',
    },
    {
      code: 'reports.create',
      name: 'Create Report',
      resource: 'reports',
      action: 'create',
      description: 'Create custom reports',
    },
    {
      code: 'reports.export',
      name: 'Export Reports',
      resource: 'reports',
      action: 'export',
      description: 'Export reports to CSV/PDF',
    },
    {
      code: 'reports.schedule',
      name: 'Schedule Reports',
      resource: 'reports',
      action: 'schedule',
      description: 'Schedule automated report generation',
    },

    // Users Module
    {
      code: 'users.view',
      name: 'View Users',
      resource: 'users',
      action: 'view',
      description: 'View user list and details',
    },
    {
      code: 'users.create',
      name: 'Create User',
      resource: 'users',
      action: 'create',
      description: 'Create new users',
    },
    {
      code: 'users.edit',
      name: 'Edit User',
      resource: 'users',
      action: 'edit',
      description: 'Edit user information',
    },
    {
      code: 'users.delete',
      name: 'Delete User',
      resource: 'users',
      action: 'delete',
      description: 'Delete users',
    },
    {
      code: 'users.manage_roles',
      name: 'Manage User Roles',
      resource: 'users',
      action: 'manage_roles',
      description: 'Assign/revoke roles to/from users',
    },

    // Roles Module
    {
      code: 'roles.view',
      name: 'View Roles',
      resource: 'roles',
      action: 'view',
      description: 'View role list and details',
    },
    {
      code: 'roles.create',
      name: 'Create Role',
      resource: 'roles',
      action: 'create',
      description: 'Create new roles',
    },
    {
      code: 'roles.edit',
      name: 'Edit Role',
      resource: 'roles',
      action: 'edit',
      description: 'Edit role information',
    },
    {
      code: 'roles.delete',
      name: 'Delete Role',
      resource: 'roles',
      action: 'delete',
      description: 'Delete roles',
    },
    {
      code: 'roles.manage_permissions',
      name: 'Manage Role Permissions',
      resource: 'roles',
      action: 'manage_permissions',
      description: 'Assign/revoke permissions to/from roles',
    },

    // Settings Module
    {
      code: 'settings.view',
      name: 'View Settings',
      resource: 'settings',
      action: 'view',
      description: 'View system settings',
    },
    {
      code: 'settings.edit',
      name: 'Edit Settings',
      resource: 'settings',
      action: 'edit',
      description: 'Edit system settings',
    },
  ];

  console.log(`🌱 Seeding ${permissions.length} permissions...`);

  try {
    for (const permission of permissions) {
      // Check if permission already exists
      const existing = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.code, permission.code))
        .limit(1);
      const foundPerm = existing[0];

      if (!foundPerm) {
        await db.insert(schema.permissions).values(permission);
        console.log(`✅ Created permission: ${permission.code}`);
      } else {
        console.log(`⏭️  Permission already exists: ${permission.code}`);
      }
    }

    console.log('✨ Permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
}
