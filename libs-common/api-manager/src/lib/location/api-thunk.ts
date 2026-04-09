import {
  GET_STATES,
  GET_DISTRICTS_BY_STATE,
  GET_PINCODES_BY_DISTRICT,
  GET_PINCODE_BY_CODE,
  GET_STATE_BY_CODE,
} from "./api-data";

// ─── States ────────────────────────────────────────────────────────────────

export const getStates = GET_STATES.generateAsyncThunk("location/getStates");

export const getStateByCode = GET_STATE_BY_CODE.generateAsyncThunk<{
  code: string;
}>("location/getStateByCode");

// ─── Districts ─────────────────────────────────────────────────────────────

export const getDistrictsByState = GET_DISTRICTS_BY_STATE.generateAsyncThunk<{
  stateId: number;
}>("location/getDistrictsByState");

// ─── Pincodes ──────────────────────────────────────────────────────────────

export const getPincodesByDistrict = GET_PINCODES_BY_DISTRICT.generateAsyncThunk<{
  districtId: number;
}>("location/getPincodesByDistrict");

export const getPincodeByCode = GET_PINCODE_BY_CODE.generateAsyncThunk<{
  code: string;
}>("location/getPincodeByCode");
