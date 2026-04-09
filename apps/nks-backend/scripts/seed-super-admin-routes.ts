/**
 * Standalone Seed Script — Super Admin Routes
 *
 * Seeds the following routes and maps them exclusively to the SUPER_ADMIN role:
 *   Dashboard        → /admin/dashboard
 *   Organizations    → /admin/stores
 *   Users            → /admin/users
 *   Billing          → /admin/billing
 *   Subscriptions    → /admin/subscriptions
 *   System Health    → /admin/system-settings
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-super-admin-routes.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import * as schema from '../src/core/database/schema';

// ─── Route definitions ──────────────────────────────────────────────────────

const SUPER_ADMIN_ROUTES = [
  {
    routeName: 'Platform Dashboard',
    routePath: '/admin/dashboard',
    fullPath: '/admin/dashboard',
    description: 'Overview of the entire NKS multi-store ecosystem',
    iconName: 'LayoutDashboard',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 10,
  },
  {
    routeName: 'Organizations',
    routePath: '/admin/stores',
    fullPath: '/admin/stores',
    description: 'Manage and monitor all business entities on the platform',
    iconName: 'Store',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 20,
  },
  {
    routeName: 'Users & Staff',
    routePath: '/admin/users',
    fullPath: '/admin/users',
    description: 'Global user directory and platform-wide staff management',
    iconName: 'Users',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 30,
  },
  {
    routeName: 'Billing',
    routePath: '/admin/billing',
    fullPath: '/admin/billing',
    description: 'Track platform-wide revenue and store invoicing',
    iconName: 'CreditCard',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 40,
  },
  {
    routeName: 'Subscriptions',
    routePath: '/admin/subscriptions',
    fullPath: '/admin/subscriptions',
    description: 'Define and manage commercial subscription tiers for businesses',
    iconName: 'Package',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 50,
  },
  {
    routeName: 'System Health',
    routePath: '/admin/system-settings',
    fullPath: '/admin/system-settings',
    description: 'Monitor platform infrastructure and manage system configurations',
    iconName: 'Activity',
    routeType: 'sidebar' as const,
    routeScope: 'admin' as const,
    isPublic: false,
    sortOrder: 60,
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('\n🌱 NKS — Super Admin Route Seeder');
  console.log('══════════════════════════════════\n');

  try {
    // 1. Resolve SUPER_ADMIN role
    const [superAdminRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'SUPER_ADMIN'))
      .limit(1);

    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found. Run `runRBACSeeds` first to seed roles.');
    }

    console.log(`✅ Found role: SUPER_ADMIN (id=${superAdminRole.id})\n`);

    // 2. Upsert routes and map to SUPER_ADMIN
    for (const routeData of SUPER_ADMIN_ROUTES) {
      // Upsert route — insert if missing, update if stale
      const [existing] = await db
        .select({ id: schema.routes.id })
        .from(schema.routes)
        .where(
          and(
            eq(schema.routes.routePath, routeData.routePath),
            eq(schema.routes.routeScope, routeData.routeScope),
          ),
        )
        .limit(1);

      let routeId: number;

      if (!existing) {
        const [inserted] = await db
          .insert(schema.routes)
          .values(routeData)
          .returning({ id: schema.routes.id });
        routeId = inserted.id;
        console.log(`  ✅ [INSERT] route  ${routeData.routePath}  (id=${routeId})`);
      } else {
        routeId = existing.id;
        await db
          .update(schema.routes)
          .set(routeData)
          .where(eq(schema.routes.id, routeId));
        console.log(`  ⬆️  [UPDATE] route  ${routeData.routePath}  (id=${routeId})`);
      }

      // Map to SUPER_ADMIN in role_route_mapping (idempotent)
      const [existingMapping] = await db
        .select({ id: schema.roleRouteMapping.id })
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
          canExport: true,
        });
        console.log(`  🔐 [MAPPED]  SUPER_ADMIN → ${routeData.routePath}`);
      } else {
        console.log(`  ⏭️  [EXISTS]  SUPER_ADMIN → ${routeData.routePath}`);
      }

      console.log();
    }

    console.log('══════════════════════════════════');
    console.log('✨ Super Admin route seeding complete!');
    console.log(`   Routes:   ${SUPER_ADMIN_ROUTES.length} seeded`);
    console.log(`   Role:     SUPER_ADMIN (id=${superAdminRole.id})`);
    console.log(`   Mappings: ${SUPER_ADMIN_ROUTES.length} enforced`);
    console.log('══════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
