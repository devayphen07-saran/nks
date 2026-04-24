import type { RouteChangeRow, StateChangeRow, DistrictChangeRow } from '../repositories/sync.repository';
import type { SyncChange } from '../dto/responses';

export class SyncDataMapper {
  /**
   * Map a raw route DB row into a SyncChange payload for mobile clients.
   * Soft-deleted rows become { operation: 'delete', data: null }.
   */
  static buildRouteChange(routeChangeRow: RouteChangeRow): SyncChange {
    return {
      table: 'routes',
      operation: routeChangeRow.deletedAt ? 'delete' : 'upsert',
      updatedAt: routeChangeRow.updatedAt.getTime(),
      data: routeChangeRow.deletedAt
        ? null
        : {
            guuid: routeChangeRow.guuid,
            parentRouteGuuid: routeChangeRow.parentRouteGuuid,
            routeName: routeChangeRow.routeName,
            routePath: routeChangeRow.routePath,
            fullPath: routeChangeRow.fullPath,
            description: routeChangeRow.description,
            iconName: routeChangeRow.iconName,
            routeType: routeChangeRow.routeType,
            routeScope: routeChangeRow.routeScope,
            isPublic: routeChangeRow.isPublic,
            isActive: routeChangeRow.isActive,
            createdAt: routeChangeRow.createdAt.toISOString(),
            updatedAt: routeChangeRow.updatedAt.toISOString(),
            deletedAt: null,
          },
    };
  }

  /**
   * Map a raw state DB row into a SyncChange payload for mobile clients.
   */
  static buildStateChange(stateChangeRow: StateChangeRow): SyncChange {
    return {
      table: 'state',
      operation: stateChangeRow.deletedAt ? 'delete' : 'upsert',
      updatedAt: stateChangeRow.updatedAt.getTime(),
      data: stateChangeRow.deletedAt
        ? null
        : {
            guuid: stateChangeRow.guuid,
            stateName: stateChangeRow.stateName,
            stateCode: stateChangeRow.stateCode,
            gstStateCode: stateChangeRow.gstStateCode,
            isUnionTerritory: stateChangeRow.isUnionTerritory,
            isActive: stateChangeRow.isActive,
            updatedAt: stateChangeRow.updatedAt.toISOString(),
            deletedAt: null,
          },
    };
  }

  /**
   * Map a raw district DB row into a SyncChange payload for mobile clients.
   */
  static buildDistrictChange(districtChangeRow: DistrictChangeRow): SyncChange {
    return {
      table: 'district',
      operation: districtChangeRow.deletedAt ? 'delete' : 'upsert',
      updatedAt: districtChangeRow.updatedAt.getTime(),
      data: districtChangeRow.deletedAt
        ? null
        : {
            guuid: districtChangeRow.guuid,
            districtName: districtChangeRow.districtName,
            districtCode: districtChangeRow.districtCode,
            lgdCode: districtChangeRow.lgdCode,
            stateGuuid: districtChangeRow.stateGuuid,
            isActive: districtChangeRow.isActive,
            updatedAt: districtChangeRow.updatedAt.toISOString(),
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
      'id',
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
