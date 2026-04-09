import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GET_LOOKUP_TYPES,
  GET_LOOKUP_VALUES,
  CREATE_SALUTATION,
  UPDATE_SALUTATION,
  DELETE_SALUTATION,
  CREATE_COUNTRY,
  UPDATE_COUNTRY,
  DELETE_COUNTRY,
  CREATE_DESIGNATION,
  UPDATE_DESIGNATION,
  DELETE_DESIGNATION,
  CREATE_STORE_LEGAL_TYPE,
  UPDATE_STORE_LEGAL_TYPE,
  DELETE_STORE_LEGAL_TYPE,
  CREATE_STORE_CATEGORY,
  UPDATE_STORE_CATEGORY,
  DELETE_STORE_CATEGORY,
  GET_SALUTATIONS,
  GET_COUNTRIES,
  GET_ADDRESS_TYPES,
  GET_COMMUNICATION_TYPES,
  GET_DESIGNATIONS,
  GET_STORE_LEGAL_TYPES,
  GET_STORE_CATEGORIES,
  GET_CURRENCIES,
  GET_VOLUMES,
  GET_SUBSCRIPTION_PLAN_TYPES,
  GET_SUBSCRIPTION_BILLING_FREQUENCIES,
  GET_SUBSCRIPTION_CURRENCIES,
  GET_SUBSCRIPTION_STATUSES,
} from "./api-data";
import type {
  LookupTypesResponse,
  LookupValuesResponse,
  SalutationsListResponse,
  SalutationResponse,
  CountriesListResponse,
  CountryResponse,
  AddressTypesListResponse,
  CommunicationTypesListResponse,
  DesignationsListResponse,
  DesignationResponse,
  StoreLegalTypesListResponse,
  StoreLegalTypeResponse,
  StoreCategoriesListResponse,
  StoreCategoryResponse,
  CurrenciesListResponse,
  VolumesListResponse,
  CreateSalutationRequest,
  UpdateSalutationRequest,
  CreateCountryRequest,
  UpdateCountryRequest,
  CreateDesignationRequest,
  UpdateDesignationRequest,
  CreateStoreLegalTypeRequest,
  UpdateStoreLegalTypeRequest,
  CreateStoreCategoryRequest,
  UpdateStoreCategoryRequest,
} from "./request-dto";

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const lookupKeys = {
  all: ["lookups"] as const,
  types: () => [...lookupKeys.all, "types"] as const,
  values: (code: string) => [...lookupKeys.all, "values", code] as const,
  salutations: () => [...lookupKeys.all, "salutations"] as const,
  countries: () => [...lookupKeys.all, "countries"] as const,
  addressTypes: () => [...lookupKeys.all, "addressTypes"] as const,
  communicationTypes: () => [...lookupKeys.all, "communicationTypes"] as const,
  designations: () => [...lookupKeys.all, "designations"] as const,
  storeLegalTypes: () => [...lookupKeys.all, "storeLegalTypes"] as const,
  storeCategories: () => [...lookupKeys.all, "storeCategories"] as const,
  currencies: () => [...lookupKeys.all, "currencies"] as const,
  volumes: () => [...lookupKeys.all, "volumes"] as const,
};

// ── Admin: Lookup Configuration Queries ────────────────────────────────────────

export const useLookupTypes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_LOOKUP_TYPES.queryOptions<LookupTypesResponse>(),
    queryKey: lookupKeys.types(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useLookupValues = (
  code: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...GET_LOOKUP_VALUES.queryOptions<LookupValuesResponse>({
      pathParam: { code },
    }),
    queryKey: lookupKeys.values(code),
    staleTime: 1000 * 60 * 5,
    enabled: (options?.enabled ?? true) && !!code,
  });
};

// ── Public: Lookup Reference Data Queries ──────────────────────────────────────

export const useSalutations = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SALUTATIONS.queryOptions<SalutationsListResponse>(),
    queryKey: lookupKeys.salutations(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useCountries = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_COUNTRIES.queryOptions<CountriesListResponse>(),
    queryKey: lookupKeys.countries(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useAddressTypes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_ADDRESS_TYPES.queryOptions<AddressTypesListResponse>(),
    queryKey: lookupKeys.addressTypes(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useCommunicationTypes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_COMMUNICATION_TYPES.queryOptions<CommunicationTypesListResponse>(),
    queryKey: lookupKeys.communicationTypes(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useDesignations = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_DESIGNATIONS.queryOptions<DesignationsListResponse>(),
    queryKey: lookupKeys.designations(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useStoreLegalTypes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_STORE_LEGAL_TYPES.queryOptions<StoreLegalTypesListResponse>(),
    queryKey: lookupKeys.storeLegalTypes(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useStoreCategories = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_STORE_CATEGORIES.queryOptions<StoreCategoriesListResponse>(),
    queryKey: lookupKeys.storeCategories(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useCurrencies = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_CURRENCIES.queryOptions<CurrenciesListResponse>(),
    queryKey: lookupKeys.currencies(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useVolumes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_VOLUMES.queryOptions<VolumesListResponse>(),
    queryKey: lookupKeys.volumes(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useSubscriptionPlanTypes = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SUBSCRIPTION_PLAN_TYPES.queryOptions<LookupValuesResponse>(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useSubscriptionBillingFrequencies = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SUBSCRIPTION_BILLING_FREQUENCIES.queryOptions<LookupValuesResponse>(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useSubscriptionCurrencies = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SUBSCRIPTION_CURRENCIES.queryOptions<LookupValuesResponse>(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

export const useSubscriptionStatuses = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...GET_SUBSCRIPTION_STATUSES.queryOptions<LookupValuesResponse>(),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
};

// ── Mutation Hooks: Salutations ─────────────────────────────────────────────────

export const useCreateSalutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    CREATE_SALUTATION.mutationOptions<
      SalutationResponse,
      CreateSalutationRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
      },
    }),
  );
};

export const useUpdateSalutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    UPDATE_SALUTATION.mutationOptions<
      SalutationResponse,
      { id: number } & UpdateSalutationRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
      },
    }),
  );
};

export const useDeleteSalutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    DELETE_SALUTATION.mutationOptions<void, number>({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
      },
    }),
  );
};

// ── Mutation Hooks: Countries ───────────────────────────────────────────────────

export const useCreateCountry = () => {
  const queryClient = useQueryClient();
  return useMutation(
    CREATE_COUNTRY.mutationOptions<CountryResponse, CreateCountryRequest>({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.countries() });
      },
    }),
  );
};

export const useUpdateCountry = () => {
  const queryClient = useQueryClient();
  return useMutation(
    UPDATE_COUNTRY.mutationOptions<
      CountryResponse,
      { id: number } & UpdateCountryRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.countries() });
      },
    }),
  );
};

export const useDeleteCountry = () => {
  const queryClient = useQueryClient();
  return useMutation(
    DELETE_COUNTRY.mutationOptions<void, number>({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.countries() });
      },
    }),
  );
};

// ── Mutation Hooks: Designations ────────────────────────────────────────────────

export const useCreateDesignation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    CREATE_DESIGNATION.mutationOptions<
      DesignationResponse,
      CreateDesignationRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.designations() });
      },
    }),
  );
};

export const useUpdateDesignation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    UPDATE_DESIGNATION.mutationOptions<
      DesignationResponse,
      { id: number } & UpdateDesignationRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.designations() });
      },
    }),
  );
};

export const useDeleteDesignation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    DELETE_DESIGNATION.mutationOptions<void, number>({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: lookupKeys.designations() });
      },
    }),
  );
};

// ── Mutation Hooks: Store Legal Types ───────────────────────────────────────────

export const useCreateStoreLegalType = () => {
  const queryClient = useQueryClient();
  return useMutation(
    CREATE_STORE_LEGAL_TYPE.mutationOptions<
      StoreLegalTypeResponse,
      CreateStoreLegalTypeRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeLegalTypes(),
        });
      },
    }),
  );
};

export const useUpdateStoreLegalType = () => {
  const queryClient = useQueryClient();
  return useMutation(
    UPDATE_STORE_LEGAL_TYPE.mutationOptions<
      StoreLegalTypeResponse,
      { id: number } & UpdateStoreLegalTypeRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeLegalTypes(),
        });
      },
    }),
  );
};

export const useDeleteStoreLegalType = () => {
  const queryClient = useQueryClient();
  return useMutation(
    DELETE_STORE_LEGAL_TYPE.mutationOptions<void, number>({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeLegalTypes(),
        });
      },
    }),
  );
};

// ── Mutation Hooks: Store Categories ────────────────────────────────────────────

export const useCreateStoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation(
    CREATE_STORE_CATEGORY.mutationOptions<
      StoreCategoryResponse,
      CreateStoreCategoryRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeCategories(),
        });
      },
    }),
  );
};

export const useUpdateStoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation(
    UPDATE_STORE_CATEGORY.mutationOptions<
      StoreCategoryResponse,
      { id: number } & UpdateStoreCategoryRequest
    >({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeCategories(),
        });
      },
    }),
  );
};

export const useDeleteStoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation(
    DELETE_STORE_CATEGORY.mutationOptions<void, number>({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: lookupKeys.storeCategories(),
        });
      },
    }),
  );
};
