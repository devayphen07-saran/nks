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
  /** Empty-state screen shown when the user has no active store. */
  NO_STORE: "/(protected)/no-store",

  // Onboarding
  ACCOUNT_TYPE: "/(protected)/(onboarding)/account-type",
  PROFILE_SETUP: "/(protected)/(onboarding)/profile-setup",
  ACCEPT_INVITE: "/(protected)/(onboarding)/accept-invite",

  // Personal
  PERSONAL_DASHBOARD: "/(protected)/(personal)/dashboard",

  // Store
  STORE_SETUP: "/(protected)/(store)/setup",
  STORE_HOME: "/(protected)/(store)/(tabs)/home",

  // Sync
  SYNC_STATUS: "/(protected)/(store)/sync-status",
  DEAD_LETTER: "/(protected)/(store)/dead-letter",
} as const;
