import { createSlice } from "@reduxjs/toolkit";
import { UserPreferences } from "@nks/shared-types";

export interface UserPreferencesState {
  response: UserPreferences | undefined;
}

const initialState: UserPreferencesState = {
  response: undefined,
};

export const userPreferencesSlice = createSlice({
  name: "userPreferences",
  initialState,
  reducers: {},
});

export default userPreferencesSlice.reducer;
