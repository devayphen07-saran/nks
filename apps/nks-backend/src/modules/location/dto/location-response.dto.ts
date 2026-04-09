export interface StateResponse {
  id: number;
  createdBy: number | null;
  modifiedBy: number | null;
  deletedBy: number | null;
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
  deletedAt: Date | null;
}

export type StateListResponse = StateResponse[];

export interface DistrictResponse {
  id: number;
  createdBy: number | null;
  modifiedBy: number | null;
  deletedBy: number | null;
  districtName: string;
  districtCode: string | null;
  lgdCode: string | null;
  stateFk: number;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export type DistrictListResponse = DistrictResponse[];

export interface PincodeResponse {
  id: number;
  createdBy: number | null;
  modifiedBy: number | null;
  deletedBy: number | null;
  code: string;
  localityName: string;
  areaName: string | null;
  districtFk: number;
  stateFk: number;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export type PincodeListResponse = PincodeResponse[];
