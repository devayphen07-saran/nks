import {
  getSecureItem,
  saveSecureItem,
  deleteSecureItem,
} from "./secure-store";

export const AUTH_STORAGE_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  user: "user",
} as const;

export type AuthStorageKeyMap = typeof AUTH_STORAGE_KEYS;

export interface AuthStorage {
  getAccessToken: () => Promise<string | null>;
  setAccessToken: (token: string) => Promise<void>;
  getRefreshToken: () => Promise<string | null>;
  setRefreshToken: (token: string) => Promise<void>;
  getUser: <T = unknown>() => Promise<T | null>;
  setUser: <T>(user: T) => Promise<void>;
  clearAuthData: () => Promise<void>;
}

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return null;
  }
};

const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

export const createAuthStorage = (
  keys?: Partial<AuthStorageKeyMap>,
): AuthStorage => {
  const resolvedKeys: AuthStorageKeyMap = {
    ...AUTH_STORAGE_KEYS,
    ...keys,
  } as AuthStorageKeyMap;

  return {
    getAccessToken: () => getSecureItem(resolvedKeys.accessToken),
    setAccessToken: (token: string) =>
      saveSecureItem(resolvedKeys.accessToken, token),
    getRefreshToken: () => getSecureItem(resolvedKeys.refreshToken),
    setRefreshToken: (token: string) =>
      saveSecureItem(resolvedKeys.refreshToken, token),
    getUser: async <T = unknown>() => {
      const stored = await getSecureItem(resolvedKeys.user);
      return safeParse<T>(stored);
    },
    setUser: async <T>(user: T) => {
      await saveSecureItem(resolvedKeys.user, stringify(user));
    },
    clearAuthData: async () => {
      await Promise.all([
        deleteSecureItem(resolvedKeys.accessToken),
        deleteSecureItem(resolvedKeys.refreshToken),
        deleteSecureItem(resolvedKeys.user),
      ]);
    },
  };
};

const defaultAuthStorage = createAuthStorage();

export const getAccessToken = defaultAuthStorage.getAccessToken;
export const setAccessToken = defaultAuthStorage.setAccessToken;
export const getRefreshToken = defaultAuthStorage.getRefreshToken;
export const setRefreshToken = defaultAuthStorage.setRefreshToken;
export const getUser = defaultAuthStorage.getUser;
export const setUser = defaultAuthStorage.setUser;
export const clearAuthData = defaultAuthStorage.clearAuthData;

export default defaultAuthStorage;
