import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  setupPersonal,
  registerStore,
  inviteStaff,
  acceptInvite,
  getStaff,
  getMyStores,
  getInvitedStores,
} from "@nks/api-manager";
import { defaultAPIState } from "@nks/shared-types";
import { StoreSliceState } from "./model";

const initialState: StoreSliceState = {
  setupPersonalState: { ...defaultAPIState },
  registerState:      { ...defaultAPIState },
  inviteStaffState:   { ...defaultAPIState },
  acceptInviteState:  { ...defaultAPIState },
  staffListState:     { ...defaultAPIState },
  myStoresState:      { ...defaultAPIState },
  invitedStoresState: { ...defaultAPIState },
  selectedStoreId:    null,
};

export const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    selectStore(state, action: PayloadAction<number | null>) {
      state.selectedStoreId = action.payload;
    },
  },
  extraReducers: (builder) => {
    /* Setup Personal */
    builder.addCase(setupPersonal.pending, (state) => {
      state.setupPersonalState.isLoading = true;
      state.setupPersonalState.hasError = false;
      state.setupPersonalState.errors = undefined;
    });
    builder.addCase(setupPersonal.fulfilled, (state, action) => {
      state.setupPersonalState.isLoading = false;
      state.setupPersonalState.response = action?.payload?.data;
    });
    builder.addCase(setupPersonal.rejected, (state, action) => {
      state.setupPersonalState.isLoading = false;
      state.setupPersonalState.hasError = true;
      state.setupPersonalState.errors = action?.payload;
    });

    /* Register Store */
    builder.addCase(registerStore.pending, (state) => {
      state.registerState.isLoading = true;
      state.registerState.hasError = false;
      state.registerState.errors = undefined;
    });
    builder.addCase(registerStore.fulfilled, (state, action) => {
      state.registerState.isLoading = false;
      state.registerState.response = action?.payload?.data;
    });
    builder.addCase(registerStore.rejected, (state, action) => {
      state.registerState.isLoading = false;
      state.registerState.hasError = true;
      state.registerState.errors = action?.payload;
    });

    /* Invite Staff */
    builder.addCase(inviteStaff.pending, (state) => {
      state.inviteStaffState.isLoading = true;
      state.inviteStaffState.hasError = false;
      state.inviteStaffState.errors = undefined;
    });
    builder.addCase(inviteStaff.fulfilled, (state, action) => {
      state.inviteStaffState.isLoading = false;
      state.inviteStaffState.response = action?.payload?.data;
    });
    builder.addCase(inviteStaff.rejected, (state, action) => {
      state.inviteStaffState.isLoading = false;
      state.inviteStaffState.hasError = true;
      state.inviteStaffState.errors = action?.payload;
    });

    /* Accept Invite */
    builder.addCase(acceptInvite.pending, (state) => {
      state.acceptInviteState.isLoading = true;
      state.acceptInviteState.hasError = false;
      state.acceptInviteState.errors = undefined;
    });
    builder.addCase(acceptInvite.fulfilled, (state, action) => {
      state.acceptInviteState.isLoading = false;
      state.acceptInviteState.response = action?.payload?.data;
    });
    builder.addCase(acceptInvite.rejected, (state, action) => {
      state.acceptInviteState.isLoading = false;
      state.acceptInviteState.hasError = true;
      state.acceptInviteState.errors = action?.payload;
    });

    /* Get Staff */
    builder.addCase(getStaff.pending, (state) => {
      state.staffListState.isLoading = true;
      state.staffListState.hasError = false;
      state.staffListState.errors = undefined;
    });
    builder.addCase(getStaff.fulfilled, (state, action) => {
      state.staffListState.isLoading = false;
      state.staffListState.response = action?.payload?.data;
    });
    builder.addCase(getStaff.rejected, (state, action) => {
      state.staffListState.isLoading = false;
      state.staffListState.hasError = true;
      state.staffListState.errors = action?.payload;
    });

    /* Get My Stores */
    builder.addCase(getMyStores.pending, (state) => {
      state.myStoresState.isLoading = true;
      state.myStoresState.hasError = false;
      state.myStoresState.errors = undefined;
    });
    builder.addCase(getMyStores.fulfilled, (state, action) => {
      state.myStoresState.isLoading = false;
      state.myStoresState.response = action?.payload?.data;
    });
    builder.addCase(getMyStores.rejected, (state, action) => {
      state.myStoresState.isLoading = false;
      state.myStoresState.hasError = true;
      state.myStoresState.errors = action?.payload;
    });

    /* Get Invited Stores */
    builder.addCase(getInvitedStores.pending, (state) => {
      state.invitedStoresState.isLoading = true;
      state.invitedStoresState.hasError = false;
      state.invitedStoresState.errors = undefined;
    });
    builder.addCase(getInvitedStores.fulfilled, (state, action) => {
      state.invitedStoresState.isLoading = false;
      state.invitedStoresState.response = action?.payload?.data;
    });
    builder.addCase(getInvitedStores.rejected, (state, action) => {
      state.invitedStoresState.isLoading = false;
      state.invitedStoresState.hasError = true;
      state.invitedStoresState.errors = action?.payload;
    });
  },
});
