import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface SeederResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Seed Software Company Admin Routes and restrict to SUPER_ADMIN
 *
 * ✅ Features:
 * - Batch route upsert (1 query)
 * - Batch mapping insert (1 query)
 * - Structured logging
 * - Validates SUPER_ADMIN role exists
 */
export async function seedAdminRoutes(
  db: NodePgDatabase<typeof schema>,
): Promise<SeederResult> {
  const logger = new Logger('AdminRoutesSeeder');
  logger.debug('Seeding admin routes with batch operations');

  const adminRoutes = [
    {
      routeName: 'Platform Dashboard',
      routePath: '/admin/dashboard',
      fullPath: '/admin/dashboard',
      description: 'Overview of the entire NKS multi-store ecosystem',
      iconName: 'LayoutDashboard',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 10,
    },
    {
      routeName: 'Organizations',
      routePath: '/admin/stores',
      fullPath: '/admin/stores',
      description: 'Manage and monitor all business entities',
      iconName: 'Store',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 20,
    },
    {
      routeName: 'Users & Staff',
      routePath: '/admin/users',
      fullPath: '/admin/users',
      description: 'Global user directory and staff management',
      iconName: 'Users',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 30,
    },
    {
      routeName: 'Billing',
      routePath: '/admin/billing',
      fullPath: '/admin/billing',
      description: 'Track platform revenue and invoicing',
      iconName: 'CreditCard',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 40,
    },
    {
      routeName: 'Subscriptions',
      routePath: '/admin/subscriptions',
      fullPath: '/admin/subscriptions',
      description: 'Define and manage subscription tiers',
      iconName: 'Package',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 50,
    },
    {
      routeName: 'Roles & Permissions',
      routePath: '/admin/roles',
      fullPath: '/admin/roles',
      description: 'Manage system roles and permissions',
      iconName: 'ShieldCheck',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 45,
    },
    {
      routeName: 'Lookup Configuration',
      routePath: '/admin/lookup-configuration',
      fullPath: '/admin/lookup-configuration',
      description: 'Manage system lookup data and configurations',
      iconName: 'Database',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 55,
    },
    {
      routeName: 'System Health',
      routePath: '/admin/system-settings',
      fullPath: '/admin/system-settings',
      description: 'Monitor platform infrastructure',
      iconName: 'Activity',
      routeType: 'sidebar' as const,
      appCode: 'NKS_WEB',
      isPublic: false,
      sortOrder: 60,
    },
  ];

  try {
    // 1. Get SUPER_ADMIN role (validate dependency)
    const [superAdminRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'SUPER_ADMIN'))
      .limit(1);

    if (!superAdminRole) {
      throw new Error(
        'Seeder error: SUPER_ADMIN role not found. Run seedRoles() first.',
      );
    }

    logger.debug('SUPER_ADMIN role found', { roleId: superAdminRole.id });

    // 2. Fetch existing routes to detect new ones
    const existingRoutes = await db
      .select({
        routePath: schema.routes.routePath,
        appCode: schema.routes.appCode,
        id: schema.routes.id,
      })
      .from(schema.routes);

    const routePathMap = new Map(
      existingRoutes.map((r) => [`${r.routePath}-${r.appCode}`, r.id]),
    );

    // 3. ✅ BATCH UPSERT all routes (1 query)
    const routeResults = await db
      .insert(schema.routes)
      .values(adminRoutes)
      .onConflictDoUpdate({
        target: [schema.routes.routePath, schema.routes.appCode],
        set: {
          routeName: sql`EXCLUDED.${schema.routes.routeName}`,
          fullPath: sql`EXCLUDED.${schema.routes.fullPath}`,
          description: sql`EXCLUDED.${schema.routes.description}`,
          iconName: sql`EXCLUDED.${schema.routes.iconName}`,
          routeType: sql`EXCLUDED.${schema.routes.routeType}`,
          isPublic: sql`EXCLUDED.${schema.routes.isPublic}`,
          sortOrder: sql`EXCLUDED.${schema.routes.sortOrder}`,
        },
      })
      .returning({ id: schema.routes.id, routePath: schema.routes.routePath });

    const createdRoutes = routeResults.filter(
      (r) => !routePathMap.has(`${r.routePath}-${adminRoutes[0].appCode}`),
    );
    logger.log('Routes seeded', {
      created: createdRoutes.length,
      updated: routeResults.length - createdRoutes.length,
    });

    // 4. Fetch existing role-route mappings
    const existingMappings = await db
      .select()
      .from(schema.roleRouteMapping)
      .where(eq(schema.roleRouteMapping.roleFk, superAdminRole.id));

    const mappingSet = new Set(existingMappings.map((m) => m.routeFk));

    // 5. ✅ BATCH INSERT role-route mappings for SUPER_ADMIN (1 query)
    const mappingsToInsert: Array<typeof schema.roleRouteMapping.$inferInsert> =
      [];

    for (const route of routeResults) {
      if (!mappingSet.has(route.id)) {
        mappingsToInsert.push({
          roleFk: superAdminRole.id,
          routeFk: route.id,
          allow: true,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        });
      }
    }

    if (mappingsToInsert.length > 0) {
      await db.insert(schema.roleRouteMapping).values(mappingsToInsert);
      logger.log('Role-route mappings created', {
        count: mappingsToInsert.length,
      });
    }

    const created = createdRoutes.length;
    const skipped = adminRoutes.length - createdRoutes.length;

    logger.log('Admin routes seeded and restricted successfully', {
      routes: created,
      mappings: mappingsToInsert.length,
    });

    return { created, skipped, failed: 0 };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error seeding admin routes', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
}
