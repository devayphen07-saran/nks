import { createSlice } from "@reduxjs/toolkit";
import { getUserDetails, updateUserDetails, verifyUserEmail } from "@nks/api-manager";
import { APIState, UserProfile, defaultAPIState } from "@nks/shared-types";

export interface UserDetailsState extends APIState {
  response: UserProfile | undefined;
}

type updateUserDetail = APIState;
type verifyUserEmail = APIState;

export interface UserProfileState {
  getUserDetail: UserDetailsState;
  updateUserDetail: updateUserDetail;
  verifyUserEmail: verifyUserEmail;
}

const initialState: UserProfileState = {
  getUserDetail: defaultAPIState,
  updateUserDetail: defaultAPIState,
  verifyUserEmail: defaultAPIState,
};

export const userProfileSlice = createSlice({
  name: "userProfile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    /* Get User Details */
    builder.addCase(getUserDetails.pending, (state) => {
      state.getUserDetail.isLoading = true;
    });
    builder.addCase(getUserDetails.fulfilled, (state, action) => {
      state.getUserDetail.isLoading = false;
      state.getUserDetail.response = action?.payload?.data;
    });
    builder.addCase(getUserDetails.rejected, (state, action) => {
      state.getUserDetail.isLoading = false;
      if (action.payload) {
        state.getUserDetail.errors = action?.payload;
      }
    });

    /* Update User Details */
    builder.addCase(updateUserDetails.pending, (state) => {
      state.updateUserDetail.isLoading = true;
    });
    builder.addCase(updateUserDetails.fulfilled, (state, action) => {
      state.updateUserDetail.isLoading = false;
      state.updateUserDetail.response = action?.payload?.data;
    });
    builder.addCase(updateUserDetails.rejected, (state, action) => {
      state.updateUserDetail.isLoading = false;
      if (action.payload) {
        state.updateUserDetail.errors = action?.payload;
      }
    });

    /* Verify User Email */
    builder.addCase(verifyUserEmail.pending, (state) => {
      state.verifyUserEmail.isLoading = true;
    });
    builder.addCase(verifyUserEmail.fulfilled, (state, action) => {
      state.verifyUserEmail.isLoading = false;
      state.verifyUserEmail.response = action?.payload?.data;
    });
    builder.addCase(verifyUserEmail.rejected, (state, action) => {
      state.verifyUserEmail.isLoading = false;
      if (action.payload) {
        state.verifyUserEmail.errors = action?.payload;
      }
    });
  },
});
