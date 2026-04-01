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
  id: number;
  guuid: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  phoneNumber: string;
  phoneNumberVerified: boolean;
  kycLevel: string;
  languagePreference: string;
  whatsappOptedIn: boolean;
  loginCount: number;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}
