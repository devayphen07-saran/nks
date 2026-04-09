import { createSlice } from "@reduxjs/toolkit";
import { defaultAPIState, defaultAPIStateList } from "@nks/shared-types";
import { ConfigState } from "./config-slice.model";

const initialState: ConfigState = {
  countries: { ...defaultAPIStateList },
  config: { ...defaultAPIState },
};

export const configMasterSlice = createSlice({
  name: "config",
  initialState,
  reducers: {},
});

export default configMasterSlice.reducer;
