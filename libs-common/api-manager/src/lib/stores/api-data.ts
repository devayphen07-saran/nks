import { APIData, APIMethod } from "../api-handler";

// ============================================
// URL Constants
// ============================================
export const STORE_ENDPOINTS = {
  LIST: "store",
  DETAIL: "store/id",
} as const;

// ============================================
// API Data Instances
// ============================================
export const GET_STORES_LIST = new APIData(STORE_ENDPOINTS.LIST, APIMethod.GET);
export const GET_STORE_DETAIL = new APIData(
  STORE_ENDPOINTS.DETAIL,
  APIMethod.GET,
);

// ============================================
// URL Builder (for client-side usage)
// ============================================
export function buildStoreUrl(
  endpoint: string,
  params?: { storeId?: string | number }
): string {
  let url = endpoint;
  if (params?.storeId !== undefined) {
    url = url.replace("id", String(params.storeId));
  }
  return url;
}
