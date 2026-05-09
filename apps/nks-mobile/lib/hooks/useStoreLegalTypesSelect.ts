import { useStoreLegalTypes as useStoreLegalTypesOnline } from "@nks/api-manager";
import { useQuery } from "@tanstack/react-query";
import { lookupRepository } from "../database/repositories";
import type { SelectMode } from "./select-mode";

export interface StoreLegalTypeSelectItem {
  code: string;
  title: string;
}

const LOOKUP_TYPE_CODE = "STORE_LEGAL_TYPE";

function useStoreLegalTypesOffline(enabled: boolean) {
  return useQuery({
    queryKey: ["lookups", "offline", LOOKUP_TYPE_CODE],
    queryFn: () => lookupRepository.findByTypeCode(LOOKUP_TYPE_CODE),
    enabled,
    staleTime: Infinity,
  });
}

export function useStoreLegalTypesSelect(mode: SelectMode = "fallback") {
  const online  = useStoreLegalTypesOnline({ enabled: mode !== "offline" });
  const offline = useStoreLegalTypesOffline(mode !== "online");

  const onlineItems: StoreLegalTypeSelectItem[] = (online.data?.data ?? []).map((t) => ({
    code:  t.code,
    title: t.title,
  }));

  const offlineItems: StoreLegalTypeSelectItem[] = (offline.data ?? []).map((t) => ({
    code:  t.code,
    title: t.label,
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
