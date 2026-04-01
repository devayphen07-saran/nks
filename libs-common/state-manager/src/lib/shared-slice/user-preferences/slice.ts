import { createSlice } from "@reduxjs/toolkit";
import {
  getUserPreferences,
  updateUserPreferences,
  updateTheme,
  updateTimezone,
} from "@nks/api-manager";
import { APIState, UserPreferences, defaultAPIState } from "@nks/shared-types";

export interface UserPreferencesState {
  getPreferences: APIState & { response: UserPreferences | undefined };
  updatePreferences: APIState;
  updateTheme: APIState;
  updateTimezone: APIState;
}

const initialState: UserPreferencesState = {
  getPreferences: { ...defaultAPIState, response: undefined },
  updatePreferences: defaultAPIState,
  updateTheme: defaultAPIState,
  updateTimezone: defaultAPIState,
};

export const userPreferencesSlice = createSlice({
  name: "userPreferences",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    /* Get Preferences */
    builder.addCase(getUserPreferences.pending, (state) => {
      state.getPreferences.isLoading = true;
    });
    builder.addCase(getUserPreferences.fulfilled, (state, action) => {
      state.getPreferences.isLoading = false;
      state.getPreferences.response = action.payload.data;
    });
    builder.addCase(getUserPreferences.rejected, (state, action) => {
      state.getPreferences.isLoading = false;
      state.getPreferences.hasError = true;
      state.getPreferences.errors = action.payload;
    });

    /* Update All Preferences */
    builder.addCase(updateUserPreferences.pending, (state) => {
      state.updatePreferences.isLoading = true;
    });
    builder.addCase(updateUserPreferences.fulfilled, (state, action) => {
      state.updatePreferences.isLoading = false;
      state.getPreferences.response = action.payload.data;
    });
    builder.addCase(updateUserPreferences.rejected, (state, action) => {
      state.updatePreferences.isLoading = false;
      state.updatePreferences.hasError = true;
      state.updatePreferences.errors = action.payload;
    });

    /* Update Theme */
    builder.addCase(updateTheme.pending, (state) => {
      state.updateTheme.isLoading = true;
    });
    builder.addCase(updateTheme.fulfilled, (state, action) => {
      state.updateTheme.isLoading = false;
      if (state.getPreferences.response) {
        state.getPreferences.response.theme = action.payload.data.theme;
      }
    });
    builder.addCase(updateTheme.rejected, (state, action) => {
      state.updateTheme.isLoading = false;
      state.updateTheme.hasError = true;
      state.updateTheme.errors = action.payload;
    });

    /* Update Timezone */
    builder.addCase(updateTimezone.pending, (state) => {
      state.updateTimezone.isLoading = true;
    });
    builder.addCase(updateTimezone.fulfilled, (state, action) => {
      state.updateTimezone.isLoading = false;
      if (state.getPreferences.response) {
        state.getPreferences.response.timezone = action.payload.data.timezone;
      }
    });
    builder.addCase(updateTimezone.rejected, (state, action) => {
      state.updateTimezone.isLoading = false;
      state.updateTimezone.hasError = true;
      state.updateTimezone.errors = action.payload;
    });
  },
});
