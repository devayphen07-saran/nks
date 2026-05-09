import { useStates as useStatesOnline } from "@nks/api-manager";
import { useQuery } from "@tanstack/react-query";
import { stateRepository } from "../database/repositories";
import type { SelectMode } from "./select-mode";

export interface StateSelectItem {
  guuid: string;
  stateName: string;
  stateCode: string;
}

function useStatesOffline(enabled: boolean) {
  return useQuery({
    queryKey: ["states", "offline"],
    queryFn: () => stateRepository.findAll(),
    enabled,
    staleTime: Infinity,
  });
}

export function useStatesSelect(mode: SelectMode = "fallback") {
  const online  = useStatesOnline({ enabled: mode !== "offline" });
  const offline = useStatesOffline(mode !== "online");

  const onlineItems: StateSelectItem[] = (online.data?.data ?? []).map((s) => ({
    guuid:     s.guuid,
    stateName: s.stateName,
    stateCode: s.stateCode,
  }));

  const offlineItems: StateSelectItem[] = (offline.data ?? []).map((s) => ({
    guuid:     s.guuid,
    stateName: s.state_name,
    stateCode: s.state_code,
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
