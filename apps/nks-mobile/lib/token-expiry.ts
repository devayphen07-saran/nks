/**
 * Token validation utilities for session management
 * Ensures tokens are valid before attempting to use them
 */

import type { AuthResponse } from "@nks/api-manager";
import type { SessionEnvelope } from "@nks/mobile-utils";
import { ONE_HOUR_MS } from "@nks/utils";
import { getServerAdjustedNow } from "./server-time";

export interface TokenExpiryInfo {
  isExpired: boolean;
  expiresAt: string | null;
  expiresIn: number; // Milliseconds remaining
  reason?: "EXPIRED" | "NO_EXPIRY_INFO" | "VALID";
}

/**
 * Validates if a token has expired based on expiresAt timestamp.
 * Uses server-adjusted time to account for device clock drift.
 * @param expiresAt ISO timestamp when token expires
 * @returns TokenExpiryInfo with detailed expiry status
 */
export const validateTokenExpiry = async (
  expiresAt?: string,
): Promise<TokenExpiryInfo> => {
  if (!expiresAt) {
    return {
      isExpired: false,
      expiresAt: null,
      expiresIn: 0,
      reason: "NO_EXPIRY_INFO",
    };
  }

  try {
    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) {
      return {
        isExpired: true,
        expiresAt,
        expiresIn: 0,
        reason: "EXPIRED",
      };
    }

    const now = await getServerAdjustedNow();
    const expiresIn = expiryTime - now;

    if (expiresIn < 0) {
      return {
        isExpired: true,
        expiresAt,
        expiresIn: 0,
        reason: "EXPIRED",
      };
    }

    return {
      isExpired: false,
      expiresAt,
      expiresIn,
      reason: "VALID",
    };
  } catch (error) {
    console.error(
      "[TokenValidation] Failed to parse expiry timestamp:",
      expiresAt,
    );
    return {
      isExpired: true,
      expiresAt,
      expiresIn: 0,
      reason: "EXPIRED",
    };
  }
};

/**
 * Validates both session token and refresh token are present and not expired
 * Used before attempting token refresh
 */
export interface RefreshValidationSuccess {
  canRefresh: true;
  refreshToken: string;
  refreshExpiresAt?: string;
}

export interface RefreshValidationFailure {
  canRefresh: false;
  error: string;
  details: string;
  expiresAt?: string;
}

export type RefreshValidationResult =
  | RefreshValidationSuccess
  | RefreshValidationFailure;

/**
 * Validates both session token and refresh token are present and not expired.
 * Uses server-adjusted time for accurate expiry checks.
 * Used before attempting token refresh.
 */
export async function validateTokensBeforeRefresh(
  envelope: SessionEnvelope<AuthResponse> | null,
): Promise<RefreshValidationResult> {
  const refreshToken = envelope?.data?.session?.refreshToken;
  const refreshExpiresAt = envelope?.data?.session?.refreshExpiresAt;

  if (!refreshToken) {
    return {
      canRefresh: false,
      error: "REFRESH_TOKEN_MISSING",
      details: "No refresh token stored",
    };
  }

  const refreshExpiry = await validateTokenExpiry(refreshExpiresAt);

  if (refreshExpiry.isExpired) {
    return {
      canRefresh: false,
      error: "REFRESH_TOKEN_EXPIRED",
      details: `Refresh token expired at ${refreshExpiresAt}`,
      expiresAt: refreshExpiresAt,
    };
  }

  if (refreshExpiry.expiresIn < ONE_HOUR_MS) {
    console.warn("[TokenValidation] Refresh token expiring soon", {
      expiresInSeconds: Math.round(refreshExpiry.expiresIn / 1000),
    });
  }

  return {
    canRefresh: true,
    refreshToken,
    refreshExpiresAt,
  };
}

