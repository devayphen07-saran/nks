import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { StoreSliceState } from "./model";

const initialState: StoreSliceState = {
  selectedStoreId: null,
};

export const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    selectStore(state, action: PayloadAction<number | null>) {
      state.selectedStoreId = action.payload;
    },
  },
});

export const { selectStore } = storeSlice.actions;

export default storeSlice.reducer;
