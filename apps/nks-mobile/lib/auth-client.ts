/**
 * Better Auth Expo client — mobile-side auth client.
 *
 * Uses two plugins:
 *   - expoClient()  — writes session cookies to SecureStore (replaces browser cookies),
 *                     adds `expo-origin` header for CORS, handles `nks-mobile://` scheme
 *   - jwtClient()   — exposes JWT-related actions (getToken, etc.)
 *
 * baseURL must point to the Better Auth server root (not /api/v1).
 * Better Auth routes are mounted under /api/auth/* on the backend.
 */

import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

// Derive server base URL from the API URL env var.
// EXPO_PUBLIC_API_URL = http://localhost:4000/api/v1
// Server base          = http://localhost:4000
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const serverBaseUrl = apiUrl.replace(/\/api\/v\d+\/?$/, "");

export const authClient = createAuthClient({
  baseURL: serverBaseUrl,
  plugins: [
    expoClient({
      scheme: "nks-mobile",
      storagePrefix: "nks.auth",
      storage: SecureStore,
    }),
    jwtClient(),
  ],
});

export type AuthClientSession = typeof authClient.$Infer.Session;
