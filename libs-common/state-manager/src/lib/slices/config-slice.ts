import { createSlice } from "@reduxjs/toolkit";
import { getConfig, getAllCountry } from "@nks/api-manager";
import { defaultAPIStateList } from "@nks/shared-types";
import { ConfigState } from "./config-slice.model";

const initialState: ConfigState = {
  countries: { ...defaultAPIStateList },
  config: { ...defaultAPIStateList },
};

export const configMasterSlice = createSlice({
  name: "config",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Countries
    builder.addCase(getAllCountry.pending, (state) => {
      state.countries.isLoading = true;
    });
    builder.addCase(getAllCountry.fulfilled, (state, action) => {
      state.countries.isLoading = false;
      state.countries.response = action.payload?.data || [];
      state.countries.hasError = false;
    });
    builder.addCase(getAllCountry.rejected, (state, action) => {
      state.countries.isLoading = false;
      state.countries.hasError = true;
      state.countries.errors = action.payload;
    });

    // Global Config
    builder.addCase(getConfig.pending, (state) => {
      state.config.isLoading = true;
    });
    builder.addCase(getConfig.fulfilled, (state, action) => {
      state.config.isLoading = false;
      state.config.response = action.payload?.data || {};
      state.config.hasError = false;
    });
    builder.addCase(getConfig.rejected, (state, action) => {
      state.config.isLoading = false;
      state.config.hasError = true;
      state.config.errors = action.payload;
    });
  },
});

export default configMasterSlice.reducer;
