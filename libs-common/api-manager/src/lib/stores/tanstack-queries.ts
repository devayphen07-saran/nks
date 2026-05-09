import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CREATE_STORE } from "./api-data";
import type { CreateStoreRequest, CreateStoreResponse } from "./request-dto";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const storeKeys = {
  all:      ["stores"] as const,
  myStores: () => [...storeKeys.all, "me"] as const,
};

// ── Mutations ──────────────────────────────────────────────────────────────────

export const useCreateStore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    ...CREATE_STORE.mutationOptions<CreateStoreResponse, CreateStoreRequest>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storeKeys.myStores() });
    },
  });
};
