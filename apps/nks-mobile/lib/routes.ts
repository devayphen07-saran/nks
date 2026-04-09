/**
 * Centralized route paths for the mobile app.
 * Avoids typos in long Expo Router paths scattered across features.
 */
export const ROUTES = {
  // Auth
  PHONE: "/(auth)/phone",
  OTP: "/(auth)/otp",

  // Onboarding
  ACCOUNT_TYPE: "/(protected)/(workspace)/(app)/(onboarding)/account-type",
  PROFILE_SETUP: "/(protected)/(workspace)/(app)/(onboarding)/profile-setup",
  ACCEPT_INVITE: "/(protected)/(workspace)/(app)/(onboarding)/accept-invite",

  // Workspace
  WORKSPACE: "/(protected)/(workspace)",

  // Personal
  PERSONAL_DASHBOARD: "/(protected)/(workspace)/(app)/(personal)/dashboard",

  // Store
  STORE_LIST: "/(protected)/(workspace)/(app)/(store)/list",
  STORE_SETUP: "/(protected)/(workspace)/(app)/(store)/setup",
  STORE_HOME: "/(protected)/(workspace)/(app)/(store)/store",
} as const;
