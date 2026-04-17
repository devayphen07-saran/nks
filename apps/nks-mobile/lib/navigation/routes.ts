/**
 * Centralized route paths for the mobile app.
 * Avoids typos in long Expo Router paths scattered across features.
 */
export const ROUTES = {
  // Auth
  PHONE: "/(auth)/phone",
  OTP: "/(auth)/otp",

  // Protected root
  PROTECTED: "/(protected)",
  NO_ACCESS: "/(protected)/no-access",

  // Onboarding
  ACCOUNT_TYPE: "/(protected)/(onboarding)/account-type",
  PROFILE_SETUP: "/(protected)/(onboarding)/profile-setup",
  ACCEPT_INVITE: "/(protected)/(onboarding)/accept-invite",

  // Personal
  PERSONAL_DASHBOARD: "/(protected)/(personal)/dashboard",

  // Store
  STORE_LIST: "/(protected)/(store)/list",
  STORE_SETUP: "/(protected)/(store)/setup",
  STORE_HOME: "/(protected)/(store)/store",
} as const;
