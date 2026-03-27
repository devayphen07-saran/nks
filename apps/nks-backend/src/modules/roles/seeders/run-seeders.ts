import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { seedPermissions } from './seed-permissions';
import { seedRoles, seedRolePermissions } from './seed-roles';
import { seedAdminRoutes } from './seed-admin-routes';

/**
 * Main seeder runner
 * Runs all RBAC seeders in correct order
 *
 * Usage:
 * import { runSeeders } from './modules/roles/seeders/run-seeders';
 * await runSeeders(db);
 */
export async function runRBACSeeds(db: NodePgDatabase<typeof schema>) {
  console.log('🌱 Starting RBAC seeding process...\n');

  try {
    // Step 1: Seed permissions first (they are referenced by roles)
    console.log('📋 Step 1: Seeding permissions...');
    await seedPermissions(db);
    console.log('');

    // Step 2: Seed roles
    console.log('👥 Step 2: Seeding roles...');
    await seedRoles(db);
    console.log('');

    // Step 3: Seed role-permission mappings
    console.log('🔗 Step 3: Seeding role-permission mappings...');
    await seedRolePermissions(db);
    console.log('');

    // Step 4: Seed admin routes and restrictions
    console.log('🗺️ Step 4: Seeding admin routes and restrictions...');
    await seedAdminRoutes(db);
    console.log('');

    console.log('✨ 🎉 RBAC seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Permissions: Created/verified ~50+ permissions');
    console.log('   ✅ Roles: Created 5 system roles');
    console.log('   ✅ Mappings: Assigned permissions to roles');
    console.log('   ✅ Admin Routes: Seeded and restricted to SUPER_ADMIN');
    console.log('');
    console.log('🚀 You can now:');
    console.log('   1. Assign roles to users via API');
    console.log('   2. Use @RequirePermission decorator on endpoints');
    console.log('   3. Check permissions in services\n');
  } catch (error) {
    console.error('❌ Error during RBAC seeding:', error);
    throw error;
  }
}
