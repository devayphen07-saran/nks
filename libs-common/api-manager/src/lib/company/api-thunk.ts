import {
  SETUP_PERSONAL,
  REGISTER_STORE,
  INVITE_STAFF,
  ACCEPT_INVITE,
  GET_STAFF,
  GET_MY_STORES,
  GET_INVITED_STORES,
  GET_STORES_PAGINATED,
  GET_STORE_DETAIL,
  SELECT_STORE_V2,
} from "./api-data";
import {
  RegisterStoreRequest,
  InviteStaffRequest,
  AcceptInviteRequest,
  UpdateStaffPermissionsRequest,
} from "./request-dto";

export const setupPersonal = SETUP_PERSONAL.generateAsyncThunk(
  "store/setupPersonal",
);

export const registerStore =
  REGISTER_STORE.generateAsyncThunk<RegisterStoreRequest>(
    "store/register",
  );

export const inviteStaff = INVITE_STAFF.generateAsyncThunk<InviteStaffRequest>(
  "store/inviteStaff",
);

export const acceptInvite =
  ACCEPT_INVITE.generateAsyncThunk<AcceptInviteRequest>("store/acceptInvite");

export const getStaff = GET_STAFF.generateAsyncThunk("store/getStaff");

export const getMyStores = GET_MY_STORES.generateAsyncThunk(
  "store/getMyStores",
);

export const getInvitedStores = GET_INVITED_STORES.generateAsyncThunk(
  "store/getInvitedStores",
);

// ✅ NEW: Paginated store list
export const getStoresPaginated = GET_STORES_PAGINATED.generateAsyncThunk(
  "store/getStoresPaginated",
);

// ✅ NEW: Store details
export const getStoreDetail = GET_STORE_DETAIL.generateAsyncThunk(
  "store/getStoreDetail",
);

// ✅ NEW: Recommended store selection endpoint (v2)
export const selectStoreV2 = SELECT_STORE_V2.generateAsyncThunk<{
  storeId: number;
}>("store/selectStoreV2");
