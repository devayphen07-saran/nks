// libs-common/api-handler/src/axios-instances.ts

import axios from "axios";

// ============================================
// Environment Variables (Next.js + Expo)
// ============================================

export const apiBaseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_NEXT_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL;

const iamBaseURL =
  process.env.NEXT_PUBLIC_IAM_API ??
  process.env.EXPO_PUBLIC_NEXT_PUBLIC_IAM_API;

// ============================================
// Axios Instances (bare - no interceptors)
// Interceptors should be set up by the consuming app:
// - Web: import "@libs-web/web-utils/axios-interceptors"
// - Mobile: set up interceptors in the app entry point
// ============================================

export const API = axios.create({
  baseURL: apiBaseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const IamAPI = axios.create({
  baseURL: iamBaseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});
