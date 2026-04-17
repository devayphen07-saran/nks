export interface APIState<T = unknown, E = unknown> {
  isLoading: boolean;
  hasError: boolean;
  response: T | undefined;
  errors: E | undefined;
}

export const defaultAPIState: APIState = {
  isLoading: false,
  hasError: false,
  response: undefined,
  errors: undefined,
};

export const defaultAPIStateList: APIState<unknown[]> = {
  ...defaultAPIState,
  response: [],
};

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
