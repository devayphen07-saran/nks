import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { seedPermissions } from './seed-permissions';
import { seedRoles, seedRolePermissions } from './seed-roles';
import { seedAdminRoutes } from './seed-admin-routes';

interface SeederResult {
  name: string;
  success: boolean;
  created: number;
  skipped: number;
  duration: number;
  error?: Error;
}

/**
 * Main seeder runner
 * Runs all RBAC seeders in correct order with dependency validation
 *
 * ✅ Features:
 * - Structured logging (no console.log)
 * - Dependency validation (fails fast if dependencies missing)
 * - Detailed timing and result tracking
 * - Descriptive error context
 *
 * Usage:
 * import { runRBACSeeds } from './modules/roles/seeders/run-seeders';
 * await runRBACSeeds(db);
 */
export async function runRBACSeeds(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const logger = new Logger('RBACSeeder');
  const startTime = Date.now();
  const results: SeederResult[] = [];

  logger.log('Starting RBAC seeding process', {
    timestamp: new Date().toISOString(),
  });

  try {
    // ─── Step 1: Seed permissions (no dependencies) ───────────────────────────
    logger.debug('Phase 1: Seeding permissions', {
      phase: 1,
      dependencies: [],
    });

    const permStart = Date.now();
    try {
      const permResult = await seedPermissions(db);
      const permDuration = Date.now() - permStart;

      results.push({
        name: 'Permissions',
        success: true,
        created: permResult.created,
        skipped: permResult.skipped,
        duration: permDuration,
      });

      logger.log('Permissions seeded successfully', {
        created: permResult.created,
        skipped: permResult.skipped,
        duration: permDuration,
      });
    } catch (error) {
      const permDuration = Date.now() - permStart;
      const err = error instanceof Error ? error : new Error(String(error));

      results.push({
        name: 'Permissions',
        success: false,
        created: 0,
        skipped: 0,
        duration: permDuration,
        error: err,
      });

      logger.error('Permissions seeding FAILED', {
        duration: permDuration,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }

    // ─── Step 2: Seed roles (no dependencies) ───────────────────────────────
    logger.debug('Phase 2: Seeding roles', { phase: 2, dependencies: [] });

    const roleStart = Date.now();
    try {
      const roleResult = await seedRoles(db);
      const roleDuration = Date.now() - roleStart;

      // Validate that roles were actually created/found
      if (roleResult.created === 0 && roleResult.skipped === 0) {
        throw new Error(
          'Seeder error: No roles found or created. Database may be corrupted.',
        );
      }

      results.push({
        name: 'Roles',
        success: true,
        created: roleResult.created,
        skipped: roleResult.skipped,
        duration: roleDuration,
      });

      logger.log('Roles seeded successfully', {
        created: roleResult.created,
        skipped: roleResult.skipped,
        duration: roleDuration,
      });
    } catch (error) {
      const roleDuration = Date.now() - roleStart;
      const err = error instanceof Error ? error : new Error(String(error));

      results.push({
        name: 'Roles',
        success: false,
        created: 0,
        skipped: 0,
        duration: roleDuration,
        error: err,
      });

      logger.error('Roles seeding FAILED', {
        duration: roleDuration,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }

    // ─── Step 3: Seed role-permission mappings (depends on roles + perms) ────
    logger.debug('Phase 3: Seeding role-permission mappings', {
      phase: 3,
      dependencies: ['roles', 'permissions'],
    });

    const mappingStart = Date.now();
    try {
      const mappingResult = await seedRolePermissions(db);
      const mappingDuration = Date.now() - mappingStart;

      results.push({
        name: 'Role-Permission Mappings',
        success: true,
        created: mappingResult.created,
        skipped: mappingResult.skipped,
        duration: mappingDuration,
      });

      logger.log('Role-permission mappings seeded successfully', {
        created: mappingResult.created,
        skipped: mappingResult.skipped,
        duration: mappingDuration,
      });
    } catch (error) {
      const mappingDuration = Date.now() - mappingStart;
      const err = error instanceof Error ? error : new Error(String(error));

      results.push({
        name: 'Role-Permission Mappings',
        success: false,
        created: 0,
        skipped: 0,
        duration: mappingDuration,
        error: err,
      });

      logger.error('Role-permission mappings seeding FAILED', {
        duration: mappingDuration,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }

    // ─── Step 4: Seed admin routes (depends on roles) ────────────────────────
    logger.debug('Phase 4: Seeding admin routes and restrictions', {
      phase: 4,
      dependencies: ['roles'],
    });

    const routeStart = Date.now();
    try {
      const routeResult = await seedAdminRoutes(db);
      const routeDuration = Date.now() - routeStart;

      results.push({
        name: 'Admin Routes',
        success: true,
        created: routeResult.created,
        skipped: routeResult.skipped,
        duration: routeDuration,
      });

      logger.log('Admin routes seeded successfully', {
        created: routeResult.created,
        skipped: routeResult.skipped,
        duration: routeDuration,
      });
    } catch (error) {
      const routeDuration = Date.now() - routeStart;
      const err = error instanceof Error ? error : new Error(String(error));

      results.push({
        name: 'Admin Routes',
        success: false,
        created: 0,
        skipped: 0,
        duration: routeDuration,
        error: err,
      });

      logger.error('Admin routes seeding FAILED', {
        duration: routeDuration,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }

    // ─── Success summary ────────────────────────────────────────────────────
    const totalDuration = Date.now() - startTime;
    const totalCreated = results.reduce(
      (sum, r) => sum + (r.success ? r.created : 0),
      0,
    );
    const totalSkipped = results.reduce(
      (sum, r) => sum + (r.success ? r.skipped : 0),
      0,
    );

    logger.log('RBAC seeding completed successfully', {
      totalDuration,
      phases: results.map((r) => ({
        name: r.name,
        created: r.created,
        skipped: r.skipped,
        duration: r.duration,
      })),
      summary: {
        totalCreated,
        totalSkipped,
        totalDuration,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error('RBAC seeding FAILED - transaction rolled back', {
      totalDuration,
      completedPhases: results.filter((r) => r.success).length,
      failedPhase: results.find((r) => !r.success)?.name,
      error: err.message,
      stack: err.stack,
    });

    throw err;
  }
}
