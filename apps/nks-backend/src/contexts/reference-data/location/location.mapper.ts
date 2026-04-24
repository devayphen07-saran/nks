import type { State } from '../../../core/database/schema/location/state/state.table';
import type { District } from '../../../core/database/schema/location/district/district.table';
import type { Pincode } from '../../../core/database/schema/location/pincode/pincode.table';
import type { StateResponse, DistrictResponse, PincodeResponse } from './dto/location-response.dto';

export class LocationMapper {
  static buildStateDto(state: State): StateResponse {
    return {
      guuid: state.guuid,
      stateName: state.stateName,
      stateCode: state.stateCode,
      gstStateCode: state.gstStateCode ?? null,
      isUnionTerritory: state.isUnionTerritory,
      description: state.description ?? null,
      isActive: state.isActive,
      isHidden: state.isHidden,
      isSystem: state.isSystem,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt ?? null,
    };
  }

  static buildDistrictDto(district: District & { stateGuuid: string }): DistrictResponse {
    return {
      guuid: district.guuid,
      districtName: district.districtName,
      districtCode: district.districtCode ?? null,
      lgdCode: district.lgdCode ?? null,
      stateGuuid: district.stateGuuid,
      description: district.description ?? null,
      isActive: district.isActive,
      isHidden: district.isHidden,
      isSystem: district.isSystem,
      createdAt: district.createdAt,
      updatedAt: district.updatedAt ?? null,
    };
  }

  static buildPincodeDto(pincode: Pincode & { districtGuuid: string }): PincodeResponse {
    return {
      guuid: pincode.guuid,
      code: pincode.code,
      localityName: pincode.localityName,
      areaName: pincode.areaName ?? null,
      districtGuuid: pincode.districtGuuid,
      latitude: pincode.latitude ?? null,
      longitude: pincode.longitude ?? null,
      isActive: pincode.isActive,
      isHidden: pincode.isHidden,
      isSystem: pincode.isSystem,
      createdAt: pincode.createdAt,
      updatedAt: pincode.updatedAt ?? null,
    };
  }
}
