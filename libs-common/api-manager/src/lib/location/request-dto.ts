// ─── States ────────────────────────────────────────────────────────────────

export interface StateResponse {
  id: number;
  stateName: string;
  stateCode: string;
  gstStateCode: string;
  isUnionTerritory: boolean;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StatesListResponse = StateResponse[];
export type StateSingleResponse = StateResponse;

// ─── Districts ─────────────────────────────────────────────────────────────

export interface DistrictResponse {
  id: number;
  districtName: string;
  districtCode?: string;
  lgdCode?: string;
  stateFk: number;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DistrictsListResponse = DistrictResponse[];
export type DistrictSingleResponse = DistrictResponse;

// ─── Pincodes ──────────────────────────────────────────────────────────────

export interface PincodeResponse {
  id: number;
  code: string;
  localityName: string;
  areaName?: string;
  districtFk: number;
  stateFk: number;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PincodesListResponse = PincodeResponse[];
export type PincodeSingleResponse = PincodeResponse;
