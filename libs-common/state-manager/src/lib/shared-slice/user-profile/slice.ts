import { createSlice } from "@reduxjs/toolkit";
import { UserProfile } from "@nks/shared-types";

export interface UserDetailsState {
  response: UserProfile | undefined;
}

export interface UserProfileState {
  getUserDetail: UserDetailsState;
}

const initialState: UserProfileState = {
  getUserDetail: { response: undefined },
};

export const userProfileSlice = createSlice({
  name: "userProfile",
  initialState,
  reducers: {},
});

export default userProfileSlice.reducer;
