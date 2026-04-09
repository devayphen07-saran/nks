/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk } from "@reduxjs/toolkit";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import type {
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from "@tanstack/react-query";
import { API } from "./axios-instances";

export enum APIMethod {
  POST = "post",
  GET = "get",
  PUT = "put",
  DELETE = "delete",
  PATCH = "patch",
}

type PossibleTypeId =
  | "shopId"
  | "productId"
  | "saleId"
  | "customerId"
  | "invoiceId"
  | "categoryId"
  | "userId"
  | "outboxEventId"
  | "storeId"
  | "storeGuuid"
  | "guuid"
  | "code"
  | "id";

type PathRecord = Partial<Record<PossibleTypeId, string | undefined>>;

export class APIData {
  path: string;
  method: APIMethod;
  // API that doesn't need auth token (login, register)
  public?: boolean;

  public constructor(
    path: string,
    method: APIMethod,
    extraProps?: { public?: boolean },
  ) {
    this.path = path;
    this.method = method;
    this.public = extraProps?.public;
  }

  private generatePath(data?: PathRecord, queryParam?: string): string {
    if (data) {
      const list = this.path.split("/");
      const updatedData = list.reduce((p, c) => {
        if (Object.keys(data).find((k) => k === c)) {
          return `${p}/${data[c as PossibleTypeId]}`;
        }
        return `${p}/${c}`;
      });
      return queryParam ? `${updatedData}${queryParam}` : updatedData;
    }
    return queryParam ? `${this.path}${queryParam}` : this.path;
  }

  private async routeMethod<T>(
    param?: RequestParams<T>,
    formData?: FormData,
    config?: AxiosRequestConfig<FormData>,
  ): Promise<AxiosResponse<any, any>> {
    const updatedPath = this.generatePath(param?.pathParam, param?.queryParam);
    const updatedConfig = this.public
      ? { ...config, headers: { ...config?.headers, Authorization: undefined } }
      : config;

    switch (this.method) {
      case APIMethod.POST:
        return API.post(updatedPath, formData ?? param?.bodyParam, updatedConfig);
      case APIMethod.GET:
        return API.get(updatedPath);
      case APIMethod.PUT:
        return API.put(updatedPath, formData ?? param?.bodyParam, updatedConfig);
      case APIMethod.PATCH:
        return API.patch(updatedPath, formData ?? param?.bodyParam, updatedConfig);
      case APIMethod.DELETE:
        return API.delete(updatedPath, { ...updatedConfig, data: param?.bodyParam });
    }
  }

  public generateAsyncThunk<T>(typePrefix: string) {
    return createAsyncThunk<any, RequestParams<T> | undefined>(
      typePrefix,
      async (param, { rejectWithValue, fulfillWithValue }) => {
        try {
          const response = await this.routeMethod<T>(param, undefined, undefined);
          return fulfillWithValue(response.data);
        } catch (error) {
          const err = error as AxiosError;
          return rejectWithValue(err.response?.data);
        }
      },
    );
  }

  // T = Request type, P = Response type
  public generateAsyncThunkV2<Returned, ThunkArg>(typePrefix: string) {
    return createAsyncThunk<Returned, RequestParams<ThunkArg> | undefined>(
      typePrefix,
      async (param, { rejectWithValue, fulfillWithValue }) => {
        try {
          const response = await this.routeMethod<ThunkArg>(param);
          return fulfillWithValue(response.data);
        } catch (error) {
          const err = error as AxiosError;
          return rejectWithValue(err.response?.data);
        }
      },
    );
  }

  public generateAsyncThunkForMultipart<T>(typePrefix: string) {
    return createAsyncThunk<any, RequestParamsMultiPart<T>>(
      typePrefix,
      async (props, { rejectWithValue, fulfillWithValue }) => {
        try {
          const formData = new FormData();
          if (props.file) {
            formData.append("file", props.file);
          }
          const config = {
            headers: { "content-type": "multipart/form-data" },
          };
          const response = await this.routeMethod<T>(
            { pathParam: props.pathParam, queryParam: props.queryParam },
            formData,
            config,
          );
          return fulfillWithValue(response.data);
        } catch (error) {
          const err = error as AxiosError;
          return rejectWithValue(err.response?.data);
        }
      },
    );
  }

  // ============================================
  // TanStack Query Support
  // ============================================

  public queryOptions<TResponse>(
    params?: RequestParams<any>
  ): Omit<UseQueryOptions<TResponse>, "enabled"> {
    return {
      queryKey: [this.path, params?.pathParam, params?.queryParam].filter(
        Boolean
      ) as QueryKey,
      queryFn: async () => {
        try {
          const response = await this.routeMethod<any>(params);
          return response.data as TResponse;
        } catch (error) {
          const err = error as AxiosError;
          throw err.response?.data ?? error;
        }
      },
    };
  }

  public mutationOptions<TResponse, TBody = unknown>(
    config?: Partial<
      Omit<UseMutationOptions<TResponse, Error, TBody>, "mutationFn">
    >
  ): UseMutationOptions<TResponse, Error, TBody> {
    return {
      mutationFn: async (data: TBody) => {
        try {
          const response = await this.routeMethod<TBody>({
            bodyParam: data,
          });
          return response.data as TResponse;
        } catch (error) {
          const err = error as AxiosError;
          throw err.response?.data ?? error;
        }
      },
      ...config,
    };
  }
}

export interface RequestParams<T> {
  bodyParam?: T;
  queryParam?: string;
  pathParam?: PathRecord;
}

export interface RequestParamsMultiPart<T> {
  request?: T;
  file: Blob;
  queryParam?: string;
  pathParam?: PathRecord;
}

