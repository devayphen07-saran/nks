import { useQuery } from "@tanstack/react-query";
import {
  GET_STATES,
  GET_DISTRICTS_BY_STATE,
  GET_PINCODES_BY_DISTRICT,
} from "./api-data";
import type {
  StatesListResponse,
  DistrictsListResponse,
  PincodesListResponse,
} from "./request-dto";

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const locationKeys = {
  all:       ["location"] as const,
  states:    () => [...locationKeys.all, "states"] as const,
  districts: (stateCode: string) =>
               [...locationKeys.all, "districts", stateCode] as const,
  pincodes:  (districtGuuid: string) =>
               [...locationKeys.all, "pincodes", districtGuuid] as const,
};

// Reference data changes rarely; keep it warm for the session.
const REFERENCE_STALE_TIME_MS = 1000 * 60 * 30;

// ── Public Reference Queries ───────────────────────────────────────────────────
//
// Used by onboarding flows (store-create form) and any screen that needs
// fresh reference data and can assume the user is online. For offline POS
// screens, read from the synced SQLite mirror instead — these REST queries
// are not the right tool for that.

export const useStates = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_STATES.queryOptions<StatesListResponse>({ queryParam: "?pageSize=100" }),
    queryKey: locationKeys.states(),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled: options?.enabled ?? true,
  });
};

export const useDistrictsByState = (
  stateCode: string | null | undefined,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...GET_DISTRICTS_BY_STATE.queryOptions<DistrictsListResponse>({
      pathParam: { code: stateCode ?? "" },
      queryParam: "?pageSize=100",
    }),
    queryKey: locationKeys.districts(stateCode ?? ""),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled: (options?.enabled ?? true) && !!stateCode,
  });
};

export const usePincodesByDistrict = (
  districtGuuid: string | null | undefined,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...GET_PINCODES_BY_DISTRICT.queryOptions<PincodesListResponse>({
      pathParam: { districtGuuid: districtGuuid ?? "" },
    }),
    queryKey: locationKeys.pincodes(districtGuuid ?? ""),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled: (options?.enabled ?? true) && !!districtGuuid,
  });
};
