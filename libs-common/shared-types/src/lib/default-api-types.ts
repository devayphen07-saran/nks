export interface APIState {
  isLoading: boolean;
  hasError: boolean;
  response: any;
  errors: any;
}

export const defaultAPIState: APIState = {
  isLoading: false,
  hasError: false,
  response: undefined,
  errors: undefined,
};

export const defaultAPIStateList: APIState = {
  ...defaultAPIState,
  response: [],
};

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  status: "success" | "error" | "warning";
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}
