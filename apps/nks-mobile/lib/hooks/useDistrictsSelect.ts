import { useDistrictsByState as useDistrictsOnline, useStates } from "@nks/api-manager";
import { useQuery } from "@tanstack/react-query";
import { districtRepository } from "../database/repositories";
import type { SelectMode } from "./select-mode";

export interface DistrictSelectItem {
  guuid: string;
  districtName: string;
  districtCode: string;
}

function useDistrictsOffline(stateGuuid: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["districts", "offline", stateGuuid ?? ""],
    queryFn: () => districtRepository.findByState(stateGuuid!),
    enabled: enabled && !!stateGuuid,
    staleTime: Infinity,
  });
}

export function useDistrictsSelect(
  stateGuuid: string | undefined,
  mode: SelectMode = "fallback",
) {
  // Online districts endpoint is keyed by stateCode, not stateGuuid.
  // Resolve the code from the states list before calling it.
  const statesResult = useStates({ enabled: mode !== "offline" && !!stateGuuid });
  const stateCode    = statesResult.data?.data?.find((s) => s.guuid === stateGuuid)?.stateCode;

  const online  = useDistrictsOnline(stateCode, { enabled: mode !== "offline" });
  const offline = useDistrictsOffline(stateGuuid, mode !== "online");

  const onlineItems: DistrictSelectItem[] = (online.data?.data ?? []).map((d) => ({
    guuid:        d.guuid,
    districtName: d.districtName,
    districtCode: d.districtCode ?? "",
  }));

  const offlineItems: DistrictSelectItem[] = (offline.data ?? []).map((d) => ({
    guuid:        d.guuid,
    districtName: d.district_name,
    districtCode: d.district_code ?? "",
  }));

  if (mode === "online") {
    return { items: onlineItems, isLoading: online.isLoading };
  }

  if (mode === "offline") {
    return { items: offlineItems, isLoading: offline.isLoading };
  }

  const shouldUseOffline = online.isError || (!online.isLoading && onlineItems.length === 0);

  return {
    items:     shouldUseOffline ? offlineItems : onlineItems,
    isLoading: online.isLoading && offline.isLoading,
  };
}
