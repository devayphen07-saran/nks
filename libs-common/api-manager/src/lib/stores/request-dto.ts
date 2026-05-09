// ─── Create Store ──────────────────────────────────────────────────────────

// Mirrors apps/nks-backend/src/contexts/organization/stores/dto/create-store.dto.ts.
export interface CreateStoreRequest {
  storeName: string;
  storeLegalTypeCode: string;
  storeCategoryCode: string;
  storeCode?: string;
  timezone?: string;
}

export interface CreateStoreResponse {
  data: { storeGuuid: string };
  message: string;
}

// ─── My Stores ─────────────────────────────────────────────────────────────

export interface StoreSummary {
  id:         number;
  guuid:      string;
  storeName:  string;
  storeCode:  string | null;
  isApproved: boolean;
  isDefault:  boolean;
  isOwner:    boolean;
  timezone:   string;
  address:    string | null;
  phone:      string | null;
  createdAt:  string;
}

export interface GetMyStoresResponse {
  data: { myStores: StoreSummary[]; invitedStores: StoreSummary[] };
  message: string;
}
