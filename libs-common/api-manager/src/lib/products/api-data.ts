import { APIData, APIMethod } from "../api-handler";

export const GET_PRODUCT_LIST: APIData = new APIData(
  "shops/shopId/products",
  APIMethod.GET,
);

export const GET_PRODUCT: APIData = new APIData(
  "shops/shopId/products/productId",
  APIMethod.GET,
);

export const ADD_PRODUCT: APIData = new APIData(
  "shops/shopId/products",
  APIMethod.POST,
);

export const EDIT_PRODUCT: APIData = new APIData(
  "shops/shopId/products/productId",
  APIMethod.PUT,
);

export const DELETE_PRODUCT: APIData = new APIData(
  "shops/shopId/products/productId",
  APIMethod.DELETE,
);

export const SEARCH_PRODUCTS: APIData = new APIData(
  "shops/shopId/products/search",
  APIMethod.GET,
);

export const UPLOAD_PRODUCTS: APIData = new APIData(
  "shops/shopId/products/import",
  APIMethod.POST,
);
