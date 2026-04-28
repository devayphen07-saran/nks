import type { AuthResponse } from "@nks/api-manager";

/**
 * Token validation utilities for secure persistence and recovery.
 * Ensures tokens are properly formatted and complete before use.
 */

export interface TokenValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate AuthResponse before persistence.
 * Ensures all required fields exist and have correct format.
 */
export function validateAuthResponse(
  authResponse: AuthResponse
): TokenValidation {
  const errors: string[] = [];

  if (!authResponse) {
    errors.push("authResponse is null or undefined");
    return { isValid: false, errors };
  }

  // Validate user data
  if (!authResponse.user?.guuid) {
    errors.push("user.guuid missing");
  }

  // Validate session token
  if (!authResponse.auth?.sessionToken) {
    errors.push("auth.sessionToken missing");
  }
  if (
    authResponse.auth?.sessionToken &&
    !/^[A-Za-z0-9_-]{50,500}$/.test(authResponse.auth.sessionToken)
  ) {
    errors.push(
      `auth.sessionToken format invalid (length: ${authResponse.auth.sessionToken.length})`
    );
  }

  // Validate session ID
  if (!authResponse.auth?.sessionId) {
    errors.push("auth.sessionId missing");
  }

  // Validate access token format (if present)
  if (authResponse.auth?.accessToken) {
    const parts = authResponse.auth.accessToken.split(".");
    if (parts.length !== 3) {
      errors.push(
        `auth.accessToken format invalid: expected 3 parts, got ${parts.length}`
      );
    }
    if (!parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
      errors.push("auth.accessToken contains invalid characters");
    }
  }

  // Validate offline token (if present)
  if (authResponse.offline?.token) {
    const parts = authResponse.offline.token.split(".");
    if (parts.length !== 3) {
      errors.push(
        `offline.token format invalid: expected 3 parts, got ${parts.length}`
      );
    }
    if (!parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
      errors.push("offline.token contains invalid characters");
    }
  }

  // Validate size (warn if too large for storage)
  const json = JSON.stringify(authResponse);
  if (json.length > 2500) {
    errors.push(
      `authResponse too large for secure storage: ${json.length} bytes (limit: ~2000)`
    );
  }

  // Validate expiry timestamps exist
  if (!authResponse.auth?.expiresAt) {
    errors.push("auth.expiresAt missing");
  }
  if (!authResponse.auth?.refreshExpiresAt) {
    errors.push("auth.refreshExpiresAt missing");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate stored session against original to detect truncation or corruption.
 */
export function validateStoredSession(
  storedResponse: AuthResponse,
  originalSize: number,
  storedSize: number
): TokenValidation {
  const errors: string[] = [];

  if (!storedResponse) {
    errors.push("storedResponse is null or undefined");
    return { isValid: false, errors };
  }

  // Check for data loss/truncation
  const dataSizeRatio = storedSize / originalSize;
  if (dataSizeRatio < 0.85) {
    errors.push(
      `Significant data loss detected: Original ${originalSize}b, ` +
        `Stored ${storedSize}b (${Math.round(dataSizeRatio * 100)}% retained)`
    );
  }

  // Validate essential fields still present after storage
  if (!storedResponse.auth?.sessionToken) {
    errors.push("sessionToken lost during storage");
  }
  if (!storedResponse.auth?.sessionId) {
    errors.push("sessionId lost during storage");
  }
  if (!storedResponse.user?.guuid) {
    errors.push("user.guuid lost during storage");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Safely get nested object value using dot notation.
 * Returns undefined if any level is missing (safe navigation).
 */
export function getNestedValue(obj: any, path: string): any {
  try {
    return path.split(".").reduce((curr, prop) => curr?.[prop], obj);
  } catch {
    return undefined;
  }
}

/**
 * Validate specific field matches between stored and original.
 */
export function validateFieldMatch(
  storedValue: any,
  expectedValue: any,
  fieldPath: string
): { valid: boolean; error?: string } {
  if (storedValue !== expectedValue) {
    return {
      valid: false,
      error:
        `Field mismatch on ${fieldPath}: ` +
        `expected ${JSON.stringify(expectedValue)}, ` +
        `got ${JSON.stringify(storedValue)}`,
    };
  }
  return { valid: true };
}

/**
 * Decode a Base64URL-encoded string without Node.js Buffer.
 * Compatible with React Native's global atob().
 */
function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

/**
 * Decode JWT header without verification (just parse structure).
 */
export function decodeJwtHeader(token: string): { kid?: string; alg?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(base64UrlDecode(parts[0]));
    return header;
  } catch {
    return null;
  }
}

/**
 * Decode JWT claims without verification (just parse structure).
 */
export function decodeJwtClaims(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const claims = JSON.parse(base64UrlDecode(parts[1]));
    return claims;
  } catch {
    return null;
  }
}
