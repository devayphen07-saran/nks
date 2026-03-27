import { APIData, APIMethod } from "../api-handler";

export const SETUP_PERSONAL: APIData = new APIData("auth/setup-personal", APIMethod.POST);

export const REGISTER_STORE: APIData = new APIData("store/register", APIMethod.POST);

export const INVITE_STAFF: APIData = new APIData("store/invite-staff", APIMethod.POST);

export const ACCEPT_INVITE: APIData = new APIData("store/accept-invite", APIMethod.POST);

export const GET_STAFF: APIData = new APIData("store/staff", APIMethod.GET);

export const UPDATE_STAFF_PERMISSIONS = (userId: number | string): APIData =>
  new APIData(`store/staff/${userId}/permissions`, APIMethod.PATCH);

export const GET_MY_STORES: APIData = new APIData("store/my-stores", APIMethod.GET);

export const GET_INVITED_STORES: APIData = new APIData("store/invited", APIMethod.GET);
