import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Seed Software Company Admin Routes and restrict to SUPER_ADMIN
 */
export async function seedAdminRoutes(db: NodePgDatabase<typeof schema>) {
  console.log('🌱 Seeding Software Company Admin Routes...');

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
    // 1. Get SUPER_ADMIN role
    const [superAdminRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'SUPER_ADMIN'))
      .limit(1);

    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found. Please seed roles first.');
    }

    for (const routeData of adminRoutes) {
      // Check if route exists
      const [existingRoute] = await db
        .select()
        .from(schema.routes)
        .where(
          and(
            eq(schema.routes.routePath, routeData.routePath),
            eq(schema.routes.appCode, routeData.appCode),
          ),
        )
        .limit(1);

      let routeId: number;

      if (!existingRoute) {
        const [inserted] = await db
          .insert(schema.routes)
          .values(routeData)
          .returning();
        routeId = inserted.id;
        console.log(`✅ Created route: ${routeData.routePath}`);
      } else {
        routeId = existingRoute.id;
        // Update existing route to match new metadata
        await db
          .update(schema.routes)
          .set(routeData)
          .where(eq(schema.routes.id, routeId));
        console.log(`⏭️  Updated existing route: ${routeData.routePath}`);
      }

      // 2. Map only to SUPER_ADMIN
      const [existingMapping] = await db
        .select()
        .from(schema.roleRouteMapping)
        .where(
          and(
            eq(schema.roleRouteMapping.roleFk, superAdminRole.id),
            eq(schema.roleRouteMapping.routeFk, routeId),
          ),
        )
        .limit(1);

      if (!existingMapping) {
        await db.insert(schema.roleRouteMapping).values({
          roleFk: superAdminRole.id,
          routeFk: routeId,
          allow: true,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        });
        console.log(`🔐 Restricted ${routeData.routePath} to SUPER_ADMIN`);
      }
    }

    console.log('✨ Admin routes seeded and restricted successfully!');
  } catch (error) {
    console.error('❌ Error seeding admin routes:', error);
    throw error;
  }
}
