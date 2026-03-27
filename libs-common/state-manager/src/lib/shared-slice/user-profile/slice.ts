import { createSlice } from "@reduxjs/toolkit";
import { getUserDetails, updateUserDetails, verifyUserEmail } from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { UserProfileState } from "./model";

const initialState: UserProfileState = {
  getUserDetail:    { ...defaultAPIState },
  updateUserDetail: { ...defaultAPIState },
  verifyUserEmail:  { ...defaultAPIState },
};

export const userProfileSlice = createSlice({
  name: "userProfile",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    /* Get User Details */
    builder.addCase(getUserDetails.pending, (state) => {
      state.getUserDetail.isLoading = true;
      state.getUserDetail.hasError  = false;
      state.getUserDetail.errors    = undefined;
    });
    builder.addCase(getUserDetails.fulfilled, (state, action) => {
      state.getUserDetail.isLoading = false;
      state.getUserDetail.response  = action?.payload?.data;
    });
    builder.addCase(getUserDetails.rejected, (state, action) => {
      state.getUserDetail.isLoading = false;
      state.getUserDetail.hasError  = true;
      state.getUserDetail.errors    = action?.payload;
    });

    /* Update User Details */
    builder.addCase(updateUserDetails.pending, (state) => {
      state.updateUserDetail.isLoading = true;
      state.updateUserDetail.hasError  = false;
      state.updateUserDetail.errors    = undefined;
    });
    builder.addCase(updateUserDetails.fulfilled, (state, action) => {
      state.updateUserDetail.isLoading = false;
      state.updateUserDetail.response  = action?.payload?.data;
    });
    builder.addCase(updateUserDetails.rejected, (state, action) => {
      state.updateUserDetail.isLoading = false;
      state.updateUserDetail.hasError  = true;
      state.updateUserDetail.errors    = action?.payload;
    });

    /* Verify User Email */
    builder.addCase(verifyUserEmail.pending, (state) => {
      state.verifyUserEmail.isLoading = true;
      state.verifyUserEmail.hasError  = false;
      state.verifyUserEmail.errors    = undefined;
    });
    builder.addCase(verifyUserEmail.fulfilled, (state, action) => {
      state.verifyUserEmail.isLoading = false;
      state.verifyUserEmail.response  = action?.payload?.data;
    });
    builder.addCase(verifyUserEmail.rejected, (state, action) => {
      state.verifyUserEmail.isLoading = false;
      state.verifyUserEmail.hasError  = true;
      state.verifyUserEmail.errors    = action?.payload;
    });
  },
});
