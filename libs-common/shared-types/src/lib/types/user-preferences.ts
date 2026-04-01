/**
 * Theme options for user preference
 */
export enum ThemeEnum {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto",
}

/**
 * User Preferences Response Model
 */
export interface UserPreferences {
  id: number;
  userFk: number;
  theme: ThemeEnum | string;
  timezone: string | null;
  notificationsEnabled: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
}
