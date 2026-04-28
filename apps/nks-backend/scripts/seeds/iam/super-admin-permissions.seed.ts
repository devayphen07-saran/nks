import {
  roles,
  entityType,
  rolePermissions,
} from '../../../src/core/database/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from '../types.js';

/**
 * Seeds role_permissions for SUPER_ADMIN — full access across every entity type.
 * One row per entity with all boolean flags = true.
 *
 * Must run AFTER: system_roles, entity_type.
 * Idempotent — ON CONFLICT DO UPDATE enforces full access even if rows existed.
 */
export async function seedSuperAdminPermissions(
  db: Db,
): Promise<{ rowCount: number }> {
  const [superAdminRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, 'SUPER_ADMIN'), isNull(roles.storeFk)))
    .limit(1);

  if (!superAdminRole) {
    throw new Error(
      'SUPER_ADMIN role not found — run system_roles seed first.',
    );
  }

  const entityTypes = await db
    .select({ id: entityType.id, code: entityType.code })
    .from(entityType)
    .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)));

  if (entityTypes.length === 0) {
    throw new Error('No entity types found — run entity_type seed first.');
  }

  const rows: (typeof rolePermissions.$inferInsert)[] = entityTypes.map(
    (et) => ({
      roleFk: superAdminRole.id,
      entityTypeFk: et.id,
      allow: true,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deny: false,
      isActive: true,
    }),
  );

  await db
    .insert(rolePermissions)
    .values(rows)
    .onConflictDoUpdate({
      target: [rolePermissions.roleFk, rolePermissions.entityTypeFk],
      set: {
        allow: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        deny: false,
        isActive: true,
      },
    });

  return { rowCount: rows.length };
}
