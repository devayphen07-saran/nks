import { useQuery } from "@tanstack/react-query";
import { API } from "../axios-instances";
import type {
  SalutationsListResponse,
  CountriesListResponse,
  AddressTypesListResponse,
  CommunicationTypesListResponse,
  DesignationsListResponse,
  StoreLegalTypesListResponse,
  StoreCategoriesListResponse,
  CurrenciesListResponse,
  VolumesListResponse,
} from "./request-dto";

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const lookupQueryKeys = {
  all: ["lookups"] as const,
  salutations: () => [...lookupQueryKeys.all, "salutations"] as const,
  countries: () => [...lookupQueryKeys.all, "countries"] as const,
  addressTypes: () => [...lookupQueryKeys.all, "addressTypes"] as const,
  communicationTypes: () => [...lookupQueryKeys.all, "communicationTypes"] as const,
  designations: () => [...lookupQueryKeys.all, "designations"] as const,
  storeLegalTypes: () => [...lookupQueryKeys.all, "storeLegalTypes"] as const,
  storeCategories: () => [...lookupQueryKeys.all, "storeCategories"] as const,
  currencies: () => [...lookupQueryKeys.all, "currencies"] as const,
  volumes: () => [...lookupQueryKeys.all, "volumes"] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useSalutations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.salutations(),
    queryFn: async () => {
      const response = await API.get<SalutationsListResponse>("lookups/salutations");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCountries(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.countries(),
    queryFn: async () => {
      const response = await API.get<CountriesListResponse>("lookups/countries");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAddressTypes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.addressTypes(),
    queryFn: async () => {
      const response = await API.get<AddressTypesListResponse>("lookups/address-types");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCommunicationTypes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.communicationTypes(),
    queryFn: async () => {
      const response = await API.get<CommunicationTypesListResponse>("lookups/communication-types");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useDesignations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.designations(),
    queryFn: async () => {
      const response = await API.get<DesignationsListResponse>("lookups/designations");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useStoreLegalTypes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.storeLegalTypes(),
    queryFn: async () => {
      const response = await API.get<StoreLegalTypesListResponse>("lookups/store-legal-types");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useStoreCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.storeCategories(),
    queryFn: async () => {
      const response = await API.get<StoreCategoriesListResponse>("lookups/store-categories");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCurrencies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.currencies(),
    queryFn: async () => {
      const response = await API.get<CurrenciesListResponse>("lookups/currencies");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useVolumes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lookupQueryKeys.volumes(),
    queryFn: async () => {
      const response = await API.get<VolumesListResponse>("lookups/volumes");
      return response.data;
    },
    enabled: options?.enabled ?? true,
  });
}
