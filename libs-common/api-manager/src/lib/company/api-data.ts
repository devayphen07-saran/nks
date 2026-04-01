import { APIData, APIMethod } from "../api-handler";

export const SETUP_PERSONAL: APIData = new APIData("auth/setup-personal", APIMethod.POST);

export const REGISTER_STORE: APIData = new APIData("store/register", APIMethod.POST);

// ✅ FIXED: Corrected paths from /store/* to /company/* to match backend
export const INVITE_STAFF: APIData = new APIData("company/invite-staff", APIMethod.POST);

export const ACCEPT_INVITE: APIData = new APIData("company/accept-invite", APIMethod.POST);

export const GET_STAFF: APIData = new APIData("company/staff", APIMethod.GET);

export const UPDATE_STAFF_PERMISSIONS = (userId: number | string): APIData =>
  new APIData(`company/staff/${userId}/permissions`, APIMethod.PATCH);

export const GET_MY_STORES: APIData = new APIData("store/my-stores", APIMethod.GET);

export const GET_INVITED_STORES: APIData = new APIData("store/invited", APIMethod.GET);

// ✅ NEW: Missing store endpoints
export const GET_STORES_PAGINATED: APIData = new APIData("store", APIMethod.GET);

export const GET_STORE_DETAIL: APIData = new APIData("store/:storeId", APIMethod.GET);

export const SELECT_STORE_V2: APIData = new APIData("store/select/:storeId", APIMethod.POST);
