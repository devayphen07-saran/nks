import type { RouteChangeRow } from '../repositories/sync.repository';
import type { SyncChange } from '../dto/responses';

export class SyncDataMapper {
  /**
   * Map a raw route DB row into a SyncChange payload for mobile clients.
   * Soft-deleted rows become { operation: 'delete', data: null }.
   */
  static routeRowToChange(row: RouteChangeRow): SyncChange {
    return {
      table: 'routes',
      id: row.id,
      operation: row.deletedAt ? 'delete' : 'upsert',
      data: row.deletedAt
        ? null
        : {
            id: row.id,
            guuid: row.guuid,
            parentRouteFk: row.parentRouteFk,
            routeName: row.routeName,
            routePath: row.routePath,
            fullPath: row.fullPath,
            description: row.description,
            iconName: row.iconName,
            routeType: row.routeType,
            routeScope: row.routeScope,
            isPublic: row.isPublic,
            isActive: row.isActive,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deletedAt: null,
          },
    };
  }

  /**
   * Field-level merge using per-field timestamps.
   *
   * For each field: the value whose {field}_updated_at timestamp
   * is newer wins. Prevents data loss when two users edited different
   * fields of the same record while both were offline.
   */
  static fieldLevelMerge(
    server: Record<string, unknown>,
    client: Record<string, unknown>,
  ): Record<string, unknown> {
    const IMMUTABLE = new Set([
      'id', 'storeId', 'store_id',
      'createdAt', 'created_at',
      'version', 'deletedAt', 'deleted_at',
    ]);

    const merged: Record<string, unknown> = { ...server };

    for (const [key, clientValue] of Object.entries(client)) {
      if (IMMUTABLE.has(key) || key.endsWith('_updatedAt') || key.endsWith('_updated_at')) {
        continue;
      }

      const clientTs = (client[`${key}_updatedAt`] ?? client[`${key}_updated_at`]) as string | undefined;
      const serverTs = (server[`${key}_updatedAt`] ?? server[`${key}_updated_at`]) as string | undefined;

      if (serverTs && clientTs) {
        if (new Date(clientTs) > new Date(serverTs)) {
          merged[key] = clientValue;
          const tsKey = `${key}_updatedAt` in server ? `${key}_updatedAt` : `${key}_updated_at`;
          merged[tsKey] = clientTs;
        }
      } else if (!serverTs && clientTs) {
        merged[key] = clientValue;
        const tsKey = `${key}_updatedAt` in client ? `${key}_updatedAt` : `${key}_updated_at`;
        merged[tsKey] = clientTs;
      }
    }

    return merged;
  }
}
