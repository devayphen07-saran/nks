import type { Db } from '../types.js';
import { routes, entityType } from '../../../src/core/database/schema/index.js';
import { inArray } from 'drizzle-orm';
import { storeRoutes, adminRoutes } from './data/routes.js';

export async function seedRoutes(db: Db) {
  const allRoutes = [...storeRoutes, ...adminRoutes];

  // Collect distinct entity type codes referenced by routes
  const codes = [...new Set(
    allRoutes.map((r) => r.entityTypeCode).filter((c): c is string => c !== null),
  )];

  // Build code → id map in one query
  const entityTypeMap = new Map<string, number>();
  if (codes.length > 0) {
    const rows = await db
      .select({ id: entityType.id, code: entityType.code })
      .from(entityType)
      .where(inArray(entityType.code, codes));
    for (const row of rows) entityTypeMap.set(row.code, row.id);
  }

  const values = allRoutes.map(({ entityTypeCode, ...rest }) => ({
    ...rest,
    entityTypeFk: entityTypeCode ? (entityTypeMap.get(entityTypeCode) ?? null) : null,
  }));

  return db.insert(routes).values(values).onConflictDoNothing();
}
