export interface StateResponse {
  guuid: string;
  stateName: string;
  stateCode: string;
  gstStateCode: string | null;
  isUnionTerritory: boolean;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface DistrictResponse {
  guuid: string;
  districtName: string;
  districtCode: string | null;
  lgdCode: string | null;
  stateGuuid: string;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PincodeResponse {
  guuid: string;
  code: string;
  localityName: string;
  areaName: string | null;
  districtGuuid: string;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
