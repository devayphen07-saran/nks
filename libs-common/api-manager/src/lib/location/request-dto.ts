// Mirrors the backend DTOs in
// apps/nks-backend/src/contexts/reference-data/location/dto/location-response.dto.ts.
// Wire identifiers are guuids, not numeric ids.

// ─── States ────────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string | null;
}

export interface StatesListResponse {
  data: StateResponse[];
  message: string;
}

export type StateSingleResponse = StateResponse;

// ─── Districts ─────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string | null;
}

export interface DistrictsListResponse {
  data: DistrictResponse[];
  message: string;
}

export type DistrictSingleResponse = DistrictResponse;

// ─── Pincodes ──────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string | null;
}

export interface PincodesListResponse {
  data: PincodeResponse[];
  message: string;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type PincodeSingleResponse = PincodeResponse;
