/**
 * Extract a single cookie value from the raw `Cookie` header string.
 * Returns undefined if the cookie is absent.
 *
 * Uses `indexOf('=')` to split on the first `=` only, correctly handling
 * Base64-encoded values that contain `=` padding.
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
