import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, sql } from 'drizzle-orm';

export interface SeederResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Seed default roles with batch insert and structured logging
 *
 * ✅ Features:
 * - Batch upsert (1 query for all 5 roles)
 * - ON CONFLICT ensures idempotency
 * - Structured logging
 * - Returns detailed metrics
 *
 * Performance: 5 roles in ~1 query
 * vs old: 10 queries (5 selects + 5 inserts)
 */
export async function seedRoles(
  db: NodePgDatabase<typeof schema>,
): Promise<SeederResult> {
  const logger = new Logger('RoleSeeder');
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

  logger.debug(`Seeding ${roles.length} roles with batch upsert`);

  try {
    // ✅ BATCH FETCH existing codes (1 query)
    const existingRoles = await db
      .select({ code: schema.roles.code })
      .from(schema.roles);

    const existingCodes = new Set(existingRoles.map((r) => r.code));

    // ✅ UPSERT all roles atomically (1 query)
    const result = await db
      .insert(schema.roles)
      .values(roles)
      .onConflictDoUpdate({
        target: schema.roles.code,
        set: {
          roleName: sql`EXCLUDED.${schema.roles.roleName}`,
          description: sql`EXCLUDED.${schema.roles.description}`,
          isActive: sql`EXCLUDED.${schema.roles.isActive}`,
        },
      })
      .returning({ code: schema.roles.code, id: schema.roles.id });

    const created = result.filter((r) => !existingCodes.has(r.code)).length;
    const skipped = existingCodes.size;

    logger.log('Roles seeded successfully', {
      total: roles.length,
      created,
      skipped,
    });

    return { created, skipped, failed: 0 };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error seeding roles', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
}

/**
 * Seed role-permission mappings for default roles with batch insert
 *
 * ✅ Features:
 * - Batch insert mappings (1 query instead of 50+)
 * - Validates all roles exist before proceeding
 * - Idempotent: safe to re-run
 */
export async function seedRolePermissions(
  db: NodePgDatabase<typeof schema>,
): Promise<SeederResult> {
  const logger = new Logger('RolePermissionSeeder');
  logger.debug('Seeding role-permission mappings with batch insert');

  try {
    // Get all roles and permissions (2 queries)
    const [allRoles, allPermissions] = await Promise.all([
      db.select().from(schema.roles),
      db.select().from(schema.permissions),
    ]);

    // Validate all required roles exist
    const superAdminRole = allRoles.find((r) => r.code === 'SUPER_ADMIN');
    const adminRole = allRoles.find((r) => r.code === 'ADMIN');
    const managerRole = allRoles.find((r) => r.code === 'MANAGER');
    const staffRole = allRoles.find((r) => r.code === 'STAFF');
    const customerRole = allRoles.find((r) => r.code === 'CUSTOMER');

    if (
      !superAdminRole ||
      !adminRole ||
      !managerRole ||
      !staffRole ||
      !customerRole
    ) {
      const missing = [
        !superAdminRole && 'SUPER_ADMIN',
        !adminRole && 'ADMIN',
        !managerRole && 'MANAGER',
        !staffRole && 'STAFF',
        !customerRole && 'CUSTOMER',
      ].filter(Boolean);
      throw new Error(
        `Seeder error: System roles not found [${missing.join(', ')}]. Run seedRoles() first.`,
      );
    }

    // Get existing mappings to detect new ones
    const existingMappings = await db
      .select()
      .from(schema.rolePermissionMapping);
    const mappingSet = new Set(
      existingMappings.map((m) => `${m.roleFk}-${m.permissionFk}`),
    );

    // ✅ Build all mappings to insert in single batch
    const mappingsToInsert: Array<
      typeof schema.rolePermissionMapping.$inferInsert
    > = [];

    // SUPER_ADMIN: All permissions (implicit, we log but don't insert)
    logger.log('SUPER_ADMIN has implicit all permissions');

    // ADMIN: All permissions except system settings
    const adminPermissions = allPermissions.filter(
      (p) => !p.resource.includes('system'),
    );
    for (const perm of adminPermissions) {
      const key = `${adminRole.id}-${perm.id}`;
      if (!mappingSet.has(key)) {
        mappingsToInsert.push({
          roleFk: adminRole.id,
          permissionFk: perm.id,
        });
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
        mappingsToInsert.push({
          roleFk: managerRole.id,
          permissionFk: perm.id,
        });
      }
    }

    // STAFF: View permissions only
    const staffPermissions = allPermissions.filter(
      (p) => p.action === 'view' || p.action === 'view_reports',
    );
    for (const perm of staffPermissions) {
      const key = `${staffRole.id}-${perm.id}`;
      if (!mappingSet.has(key)) {
        mappingsToInsert.push({
          roleFk: staffRole.id,
          permissionFk: perm.id,
        });
      }
    }

    // CUSTOMER: No explicit permissions (access controlled separately)
    logger.log('CUSTOMER role created (access controlled separately)');

    // ✅ BATCH INSERT all new mappings in single query
    let created = 0;
    if (mappingsToInsert.length > 0) {
      await db.insert(schema.rolePermissionMapping).values(mappingsToInsert);
      created = mappingsToInsert.length;
    }

    const skipped = mappingSet.size;

    logger.log('Role-permission mappings seeded successfully', {
      total: allPermissions.length * 4, // Estimated max
      created,
      skipped,
    });

    return { created, skipped, failed: 0 };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error seeding role-permissions', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
}
