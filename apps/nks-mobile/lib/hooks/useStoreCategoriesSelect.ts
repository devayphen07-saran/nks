import { useStoreCategories as useStoreCategoriesOnline } from "@nks/api-manager";
import { useQuery } from "@tanstack/react-query";
import { lookupRepository } from "../database/repositories";
import type { SelectMode } from "./select-mode";

export interface StoreCategorySelectItem {
  code: string;
  title: string;
}

const LOOKUP_TYPE_CODE = "STORE_CATEGORY";

function useStoreCategoriesOffline(enabled: boolean) {
  return useQuery({
    queryKey: ["lookups", "offline", LOOKUP_TYPE_CODE],
    queryFn: () => lookupRepository.findByTypeCode(LOOKUP_TYPE_CODE),
    enabled,
    staleTime: Infinity,
  });
}

export function useStoreCategoriesSelect(mode: SelectMode = "fallback") {
  const online  = useStoreCategoriesOnline({ enabled: mode !== "offline" });
  const offline = useStoreCategoriesOffline(mode !== "online");

  const onlineItems: StoreCategorySelectItem[] = (online.data?.data ?? []).map((c) => ({
    code:  c.code,
    title: c.title,
  }));

  const offlineItems: StoreCategorySelectItem[] = (offline.data ?? []).map((c) => ({
    code:  c.code,
    title: c.label,
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
