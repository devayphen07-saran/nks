import type {
  StateChangeRow,
  DistrictChangeRow,
} from '../../reference-data/location/repositories/location.repository';
import type { SyncChange } from '../dto/responses';

export class SyncDataMapper {
  /**
   * Map a raw state DB row into a SyncChange payload for mobile clients.
   * Soft-deleted rows become { operation: 'delete', data: null }.
   */
  static buildStateChange(stateChangeRow: StateChangeRow): SyncChange {
    const updatedAt = stateChangeRow.updatedAt ?? new Date(0);
    return {
      table: 'state',
      operation: stateChangeRow.deletedAt ? 'delete' : 'upsert',
      updatedAt: updatedAt.getTime(),
      data: stateChangeRow.deletedAt
        ? null
        : {
            guuid: stateChangeRow.guuid,
            stateName: stateChangeRow.stateName,
            stateCode: stateChangeRow.stateCode,
            gstStateCode: stateChangeRow.gstStateCode,
            isUnionTerritory: stateChangeRow.isUnionTerritory,
            isActive: stateChangeRow.isActive,
            updatedAt: updatedAt.toISOString(),
            deletedAt: null,
          },
    };
  }

  /**
   * Map a raw district DB row into a SyncChange payload for mobile clients.
   */
  static buildDistrictChange(districtChangeRow: DistrictChangeRow): SyncChange {
    const updatedAt = districtChangeRow.updatedAt ?? new Date(0);
    return {
      table: 'district',
      operation: districtChangeRow.deletedAt ? 'delete' : 'upsert',
      updatedAt: updatedAt.getTime(),
      data: districtChangeRow.deletedAt
        ? null
        : {
            guuid: districtChangeRow.guuid,
            districtName: districtChangeRow.districtName,
            districtCode: districtChangeRow.districtCode,
            lgdCode: districtChangeRow.lgdCode,
            stateGuuid: districtChangeRow.stateGuuid,
            isActive: districtChangeRow.isActive,
            updatedAt: updatedAt.toISOString(),
            deletedAt: null,
          },
    };
  }
}
