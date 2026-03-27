import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq } from 'drizzle-orm';

/**
 * Seed default roles
 * Run once after database setup
 */
export async function seedRoles(db: NodePgDatabase<typeof schema>) {
  const roles: Array<typeof schema.roles.$inferInsert> = [
    {
      code: 'SUPER_ADMIN',
      roleName: 'Super Administrator',
      description: 'Full access to all system features',
      storeFk: null, // Global role
      isActive: true,
      isSystem: true,
    },
    {
      code: 'ADMIN',
      roleName: 'Administrator',
      description: 'Company administrator with full feature access',
      storeFk: null, // Global role
      isActive: true,
      isSystem: true,
    },
    {
      code: 'MANAGER',
      roleName: 'Manager',
      description: 'Store/department manager with operational access',
      storeFk: null, // Can be assigned per store
      isActive: true,
      isSystem: true,
    },
    {
      code: 'STAFF',
      roleName: 'Staff',
      description: 'Staff member with limited operational access',
      storeFk: null,
      isActive: true,
      isSystem: true,
    },
    {
      code: 'CUSTOMER',
      roleName: 'Customer',
      description: 'Customer portal access with read-only permissions',
      storeFk: null,
      isActive: true,
      isSystem: true,
    },
  ];

  console.log(`🌱 Seeding ${roles.length} roles...`);

  try {
    const createdRoles: Record<string, any> = {};

    for (const role of roles) {
      // Check if role already exists
      const existing = await db
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, role.code))
        .limit(1);
      const foundRole = existing[0];

      if (!foundRole) {
        const [created] = await db
          .insert(schema.roles)
          .values(role)
          .returning();
        createdRoles[role.code] = created;
        console.log(`✅ Created role: ${role.code} (ID: ${created.id})`);
      } else {
        createdRoles[foundRole.code] = foundRole;
        console.log(
          `⏭️  Role already exists: ${foundRole.code} (ID: ${foundRole.id})`,
        );
      }
    }

    console.log('✨ Roles seeded successfully!');
    return createdRoles;
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    throw error;
  }
}

/**
 * Seed role-permission mappings for default roles
 */
export async function seedRolePermissions(
  db: NodePgDatabase<typeof schema>,
) {
  console.log(`🌱 Seeding role-permission mappings...`);

  try {
    // Get all roles and permissions
    const allRoles = await db.select().from(schema.roles);
    const allPermissions = await db.select().from(schema.permissions);

    const superAdminRole = allRoles.find((r) => r.code === 'SUPER_ADMIN');
    const adminRole = allRoles.find((r) => r.code === 'ADMIN');
    const managerRole = allRoles.find((r) => r.code === 'MANAGER');
    const staffRole = allRoles.find((r) => r.code === 'STAFF');
    const customerRole = allRoles.find((r) => r.code === 'CUSTOMER');

    if (!superAdminRole || !adminRole || !managerRole || !staffRole || !customerRole) {
      throw new Error('Some system roles not found. Run seedRoles first.');
    }

    // Get existing mappings to avoid duplicates
    const existingMappings = await db.select().from(schema.rolePermissionMapping);
    const mappingSet = new Set(
      existingMappings.map((m) => `${m.roleFk}-${m.permissionFk}`),
    );

    // SUPER_ADMIN: All permissions (except we won't explicitly map, it's implicit)
    console.log('✅ SUPER_ADMIN has implicit all permissions');

    // ADMIN: All permissions except system settings
    const adminPermissions = allPermissions.filter(
      (p) => !p.resource.includes('system'),
    );
    for (const perm of adminPermissions) {
      const key = `${adminRole.id}-${perm.id}`;
      if (!mappingSet.has(key)) {
        await db.insert(schema.rolePermissionMapping).values({
          roleFk: adminRole.id,
          permissionFk: perm.id,
        });
        console.log(`✅ Assigned ${perm.code} to ADMIN`);
      }
    }

    // MANAGER: View and create permissions (no delete/edit for critical)
    const managerPermissions = allPermissions.filter(
      (p) =>
        p.action === 'view' ||
        p.action === 'create' ||
        p.action === 'view_reports' ||
        (p.resource === 'orders' && p.action === 'edit') ||
        (p.resource === 'invoices' && p.action === 'mark_paid'),
    );
    for (const perm of managerPermissions) {
      const key = `${managerRole.id}-${perm.id}`;
      if (!mappingSet.has(key)) {
        await db.insert(schema.rolePermissionMapping).values({
          roleFk: managerRole.id,
          permissionFk: perm.id,
        });
        console.log(`✅ Assigned ${perm.code} to MANAGER`);
      }
    }

    // STAFF: View permissions only
    const staffPermissions = allPermissions.filter(
      (p) => p.action === 'view' || p.action === 'view_reports',
    );
    for (const perm of staffPermissions) {
      const key = `${staffRole.id}-${perm.id}`;
      if (!mappingSet.has(key)) {
        await db.insert(schema.rolePermissionMapping).values({
          roleFk: staffRole.id,
          permissionFk: perm.id,
        });
        console.log(`✅ Assigned ${perm.code} to STAFF`);
      }
    }

    // CUSTOMER: View own data only (no permissions, access controlled separately)
    console.log('✅ CUSTOMER role created (access controlled separately)');

    console.log('✨ Role-permission mappings seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding role-permissions:', error);
    throw error;
  }
}
