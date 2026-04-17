import type { AuthResponse } from "@nks/api-manager";
import { sessionTokenReg, base64UrlReg } from "@nks/utils";
import {
  SECURESTORE_LIMIT_BYTES,
  SECURESTORE_WARNING_BYTES,
  SECURESTORE_CRITICAL_BYTES,
} from "@nks/mobile-utils";

/**
 * Token validation utilities for secure persistence and recovery.
 * Ensures tokens are properly formatted and complete before use.
 *
 * Log sanitization and safe logging live in log-sanitizer.ts.
 */

export interface TokenValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates AuthResponse structure and content.
 *
 * Two modes:
 * 1. Pre-persistence: checks all required fields exist and format is valid
 * 2. Post-persistence: checks if data was truncated during storage (pass originalSize + storedSize)
 */
export function validateAuthResponse(
  authResponse: AuthResponse,
  options?: { originalSize?: number; storedSize?: number },
): TokenValidation {
  const errors: string[] = [];

  if (!authResponse) {
    errors.push("authResponse is null or undefined");
    return { isValid: false, errors };
  }

  // ─── User ────────────────────────────────────────────────────────────────
  if (!authResponse.user?.id) errors.push("user.id missing");
  if (!authResponse.user?.guuid) errors.push("user.guuid missing");

  // ─── Session token ────────────────────────────────────────────────────────
  if (!authResponse.session?.sessionToken) {
    errors.push("session.sessionToken missing");
  } else if (!sessionTokenReg.test(authResponse.session.sessionToken)) {
    errors.push(
      `session.sessionToken format invalid (length: ${authResponse.session.sessionToken.length})`,
    );
  }

  if (!authResponse.session?.sessionId)
    errors.push("session.sessionId missing");

  // ─── JWT token (optional) ─────────────────────────────────────────────────
  if (authResponse.session?.jwtToken) {
    const parts = authResponse.session.jwtToken.split(".");
    if (parts.length !== 3) {
      errors.push(
        `jwtToken format invalid: expected 3 parts, got ${parts.length}`,
      );
    } else if (!parts.every((p) => base64UrlReg.test(p))) {
      errors.push("jwtToken contains invalid characters");
    }
  }

  // ─── Offline token (optional) ─────────────────────────────────────────────
  if (authResponse.offlineToken) {
    const parts = authResponse.offlineToken.split(".");
    if (parts.length !== 3) {
      errors.push(
        `offlineToken format invalid: expected 3 parts, got ${parts.length}`,
      );
    } else if (!parts.every((p) => base64UrlReg.test(p))) {
      errors.push("offlineToken contains invalid characters");
    }
  }

  // ─── Expiry timestamps ────────────────────────────────────────────────────
  if (!authResponse.session?.expiresAt)
    errors.push("session.expiresAt missing");
  if (!authResponse.session?.refreshExpiresAt)
    errors.push("session.refreshExpiresAt missing");

  // ─── Truncation detection (post-persistence only) ─────────────────────────
  if (
    options?.originalSize !== undefined &&
    options?.storedSize !== undefined
  ) {
    const dataSizeRatio = options.storedSize / options.originalSize;
    if (dataSizeRatio < 0.85) {
      errors.push(
        `Significant data loss detected: Original ${options.originalSize}b, ` +
          `Stored ${options.storedSize}b (${Math.round(dataSizeRatio * 100)}% retained)`,
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates refresh token JWT format before use.
 * Prevents corrupted tokens from being accepted and persisted.
 */
export function validateRefreshTokenFormat(token: string | null | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (!token) {
    return { isValid: false, error: "Refresh token missing" };
  }

  // Refresh token is an opaque base64-encoded token (not a JWT).
  // Validate it has sufficient length and only valid base64 characters.
  if (token.length < 20) {
    return {
      isValid: false,
      error: `Refresh token too short: ${token.length} chars`,
    };
  }

  const base64Reg = /^[A-Za-z0-9+/=_-]+$/;
  if (!base64Reg.test(token)) {
    return {
      isValid: false,
      error: "Refresh token contains invalid characters",
    };
  }

  return { isValid: true };
}

/**
 * Analyze storage usage against SecureStore 1800-byte limit.
 * Detects when approaching capacity and warns about potential data loss.
 */
export function analyzeStorageUsage(authResponse: AuthResponse): {
  sizeBytes: number;
  limitBytes: number;
  usagePercent: number;
  status: "safe" | "warning" | "critical";
  message?: string;
} {
  const sizeBytes = JSON.stringify(authResponse).length;
  const usagePercent = Math.round((sizeBytes / SECURESTORE_LIMIT_BYTES) * 100);

  let status: "safe" | "warning" | "critical" = "safe";
  let message: string | undefined;

  if (sizeBytes > SECURESTORE_CRITICAL_BYTES) {
    status = "critical";
    message =
      `CRITICAL: Auth data is ${usagePercent}% of SecureStore limit. Consider clearing cached tokens.`;
  } else if (sizeBytes > SECURESTORE_WARNING_BYTES) {
    status = "warning";
    message =
      `Storage usage at ${usagePercent}% capacity. ` +
      `If you manage >3 stores, roles may be truncated on next sync.`;
  }

  return {
    sizeBytes,
    limitBytes: SECURESTORE_LIMIT_BYTES,
    usagePercent,
    status,
    message,
  };
}
