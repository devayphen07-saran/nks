/**
 * OTP utility functions
 * Pure, reusable functions for OTP handling
 */

import { OTP_LENGTH, otpReg } from "./constants";

export function sanitizeOtpInput(input: string): string {
  return input.replace(/[^\d]/g, "").slice(0, OTP_LENGTH);
}

export function isOtpComplete(otp: string): boolean {
  return otpReg.test(otp);
}

export function isValidOtp(otp: string): boolean {
  return otpReg.test(otp);
}

/**
 * Format OTP for display (e.g., "123456" → "123 456")
 * @param otp OTP string
 * @returns Formatted OTP
 * @example
 * formatOtpForDisplay("123456") → "123 456"
 */
export function formatOtpForDisplay(otp: string): string {
  if (otp.length <= 3) return otp;
  return otp.slice(0, 3) + " " + otp.slice(3);
}

/**
 * Calculate OTP expiry time
 * @param expirySeconds Seconds until OTP expires (e.g., 300 for 5 minutes)
 * @returns Object with minutes, seconds, and isExpired
 * @example
 * const { minutes, seconds } = calculateOtpExpiry(123);
 * // { minutes: 2, seconds: 3, isExpired: false }
 */
export function calculateOtpExpiry(expirySeconds: number): {
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const minutes = Math.floor(expirySeconds / 60);
  const seconds = expirySeconds % 60;

  return {
    minutes,
    seconds,
    isExpired: expirySeconds <= 0,
  };
}

/**
 * Format OTP expiry for display
 * @param expirySeconds Seconds until OTP expires
 * @returns Formatted string like "2:45"
 * @example
 * formatOtpExpiry(165) → "2:45"
 */
export function formatOtpExpiry(expirySeconds: number): string {
  const { minutes, seconds } = calculateOtpExpiry(expirySeconds);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Get OTP expiry message based on remaining time
 * @param expirySeconds Seconds until OTP expires
 * @returns User-friendly message
 * @example
 * getOtpExpiryMessage(30) → "Expires in 30 seconds"
 * getOtpExpiryMessage(300) → "Expires in 5 minutes"
 */
export function getOtpExpiryMessage(expirySeconds: number): string {
  if (expirySeconds <= 0) {
    return "OTP has expired";
  }

  if (expirySeconds < 60) {
    return `Expires in ${expirySeconds} second${expirySeconds !== 1 ? "s" : ""}`;
  }

  const minutes = Math.ceil(expirySeconds / 60);
  return `Expires in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
