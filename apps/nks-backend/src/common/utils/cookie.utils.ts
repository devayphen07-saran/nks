/**
 * Cookie parsing utilities — single implementation shared across guards,
 * middleware, and controllers.
 *
 * Uses `indexOf('=')` to split on the first `=` only, which correctly handles
 * Base64-encoded cookie values that contain `=` padding characters.
 */

/**
 * Extract a single cookie value from the raw `Cookie` header string.
 * Returns undefined if the cookie is absent.
 */
export function extractCookieValue(
  cookieHeader: string,
  name: string,
): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    if (trimmed.substring(0, eqIdx).trim() === name) {
      return trimmed.substring(eqIdx + 1);
    }
  }
  return undefined;
}

/**
 * Parse all cookies from the raw `Cookie` header into a key→value map.
 */
export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    cookies[key] = trimmed.substring(eqIdx + 1);
  }
  return cookies;
}
