import { GET_MY_STORES, SET_DEFAULT_STORE } from "./api-data";

export const getMyStores = GET_MY_STORES.generateAsyncThunk("stores/getMyStores");

export const setDefaultStore = SET_DEFAULT_STORE.generateAsyncThunk<{ storeGuuid: string }>(
  "stores/setDefault"
);
