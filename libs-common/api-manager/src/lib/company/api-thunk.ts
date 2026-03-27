import {
  SETUP_PERSONAL,
  REGISTER_STORE,
  INVITE_STAFF,
  ACCEPT_INVITE,
  GET_STAFF,
  GET_MY_STORES,
  GET_INVITED_STORES,
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
