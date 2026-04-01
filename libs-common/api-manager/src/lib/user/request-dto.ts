export interface UpdateUserDetailsRequest {
  name?: string;
  email?: string;
  phoneNumber?: string;
  image?: string;
  languagePreference?: 'en' | 'ta';
  whatsappOptedIn?: boolean;
}

export interface VerifyUserEmailRequest {
  token: string;
}

export interface UpdateUserPreferencesRequest {
  theme?: "light" | "dark" | "auto";
  timezone?: string;
  notificationsEnabled?: boolean;
}

export interface UpdateThemeRequest {
  theme: "light" | "dark" | "auto";
}

export interface UpdateTimezoneRequest {
  timezone: string;
}
