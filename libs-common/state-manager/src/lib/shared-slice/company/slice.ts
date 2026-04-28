import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { StoreSliceState } from "./model";

const initialState: StoreSliceState = {
  selectedStoreId: null,
  activeStoreGuuid: null,
  activeStoreName: null,
};

export const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    selectStore(state, action: PayloadAction<number | null>) {
      state.selectedStoreId = action.payload;
    },
    setActiveStore(
      state,
      action: PayloadAction<{ guuid: string; name: string } | null>,
    ) {
      state.activeStoreGuuid = action.payload?.guuid ?? null;
      state.activeStoreName = action.payload?.name ?? null;
    },
    clearActiveStore(state) {
      state.activeStoreGuuid = null;
      state.activeStoreName = null;
    },
  },
});

export const { selectStore, setActiveStore, clearActiveStore } = storeSlice.actions;

export default storeSlice.reducer;
