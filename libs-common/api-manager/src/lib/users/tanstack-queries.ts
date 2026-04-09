import { useQuery } from "@tanstack/react-query";
import { API } from "../axios-instances";
import type { ListUsersParams, UsersListResponse } from "./request-dto";
import { USER_ENDPOINTS } from "./api-data";

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params?: ListUsersParams) => [...userKeys.lists(), params] as const,
};

// ── List Query ─────────────────────────────────────────────────────────────────

export function useUsers(
  params?: ListUsersParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params?.search) qs.set("search", params.search);

      const url = qs.toString()
        ? `${USER_ENDPOINTS.LIST}?${qs}`
        : USER_ENDPOINTS.LIST;
      const response = await API.get<UsersListResponse>(url);
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}
