import { useQuery } from "@tanstack/react-query";
import { API } from "../axios-instances";
import { buildStoreUrl, STORE_ENDPOINTS } from "./api-data";
import type {
  StoreListParams,
  StoreListResponse,
  StoreDetailResponse,
} from "./request-dto";

// ============================================
// Query Keys Factory
// ============================================
export const storeKeys = {
  all: ["stores"] as const,

  lists: () => [...storeKeys.all, "list"] as const,
  list: (params?: StoreListParams) => [...storeKeys.lists(), params] as const,

  details: () => [...storeKeys.all, "detail"] as const,
  detail: (storeId: string | number) =>
    [...storeKeys.details(), storeId] as const,
};

// ============================================
// List Query
// ============================================
export function useStores(
  params?: StoreListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: storeKeys.list(params),
    queryFn: async () => {
      const url = buildStoreUrl(STORE_ENDPOINTS.LIST);

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.pageSize)
        queryParams.set("pageSize", String(params.pageSize));
      if (params?.search) queryParams.set("search", params.search);
      if (params?.sortBy) queryParams.set("sortBy", params.sortBy);
      if (params?.sortOrder) queryParams.set("sortOrder", params.sortOrder);

      const qs = queryParams.toString();
      const fullUrl = qs ? `${url}?${qs}` : url;
      const response = await API.get<StoreListResponse>(fullUrl);
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

// ============================================
// Detail Query
// ============================================
export function useStore(
  storeId: string | number,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: async () => {
      const url = buildStoreUrl(STORE_ENDPOINTS.DETAIL, { storeId });
      const response = await API.get<StoreDetailResponse>(url);
      return response.data;
    },
    enabled: options?.enabled ?? !!storeId,
  });
}
