import { APIState } from "@nks/shared-types";

export interface StoreSliceState {
  setupPersonalState:          APIState;
  registerState:               APIState;
  inviteStaffState:            APIState;
  acceptInviteState:           APIState;
  staffListState:              APIState;
  myStoresState:               APIState;
  invitedStoresState:          APIState;
  selectedStoreId:             number | null;
}
