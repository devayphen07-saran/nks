/**
 * Returns the API base URL without the versioned path segment.
 *
 * EXPO_PUBLIC_API_URL is expected to be something like:
 *   https://api.example.com/api/v1
 *
 * Endpoints that don't go through the versioned API router (e.g. JWKS, auth
 * sub-paths called via fetchWithTimeout) need the bare host + optional prefix.
 */
export function getServerBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  return apiUrl.replace(/\/api\/v\d+\/?$/, "");
}
