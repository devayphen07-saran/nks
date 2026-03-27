import {
  GET_PRODUCT_LIST,
  GET_PRODUCT,
  ADD_PRODUCT,
  EDIT_PRODUCT,
  DELETE_PRODUCT,
  SEARCH_PRODUCTS,
  UPLOAD_PRODUCTS,
} from './api-data';
import { CreateProductRequest, UpdateProductRequest } from './request-dto';

export const getProductList = GET_PRODUCT_LIST.generateAsyncThunk(
  'products/getProductList',
);

export const getProduct = GET_PRODUCT.generateAsyncThunk(
  'products/getProduct',
);

export const addProduct = ADD_PRODUCT.generateAsyncThunk<CreateProductRequest>(
  'products/addProduct',
);

export const editProduct = EDIT_PRODUCT.generateAsyncThunk<UpdateProductRequest>(
  'products/editProduct',
);

export const deleteProduct = DELETE_PRODUCT.generateAsyncThunk(
  'products/deleteProduct',
);

export const searchProducts = SEARCH_PRODUCTS.generateAsyncThunk(
  'products/searchProducts',
);

export const uploadProducts = UPLOAD_PRODUCTS.generateAsyncThunkForMultipart(
  'products/uploadProducts',
);
