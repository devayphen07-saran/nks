/**
 * Phone utility functions
 * Pure, reusable functions for phone formatting and manipulation
 */

import { phoneReg, INDIA_DIAL_CODE, PHONE_LENGTH } from "./constants";

export function formatPhoneWithCountryCode(phone: string): string {
  // Strip any existing +XX or +XXX prefix so this function is safe to call on
  // already-formatted numbers without producing a double-prefix like ++91...
  const digits = phone.trim().replace(/^\+\d{1,3}/, '');
  return INDIA_DIAL_CODE + digits;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 5) return phone;
  const countryCode = phone.startsWith("+") ? phone.slice(0, 3) : "";
  const visibleDigits = phone.slice(-4);
  const hiddenDigits = phone.slice(countryCode.length, -4).replace(/\d/g, "*");
  return countryCode + hiddenDigits + visibleDigits;
}

export function isValidPhone(phone: string): boolean {
  return phoneReg.test(phone.trim());
}

/**
 * Sanitize phone input - remove non-digits
 * @param input User input
 * @returns Sanitized 10-digit phone (or less if incomplete)
 * @example
 * sanitizePhoneInput("+91 9025 866 666") → "9025866666"
 * sanitizePhoneInput("(902) 586-6666") → "9025866666"
 */
export function sanitizePhoneInput(input: string): string {
  return input.replace(/[^\d]/g, "").slice(0, PHONE_LENGTH);
}

/**
 * Extract country code from full phone
 * @param phone Full phone with country code
 * @returns Country code (e.g., "+91")
 * @example
 * getCountryCode("+919025863606") → "+91"
 */
export function getCountryCode(phone: string): string {
  return phone.startsWith("+") ? phone.slice(0, 3) : "";
}

/**
 * Extract digits from full phone
 * @param phone Full phone with country code
 * @returns 10-digit phone number
 * @example
 * getPhoneDigits("+919025863606") → "9025866666"
 */
export function getPhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "").slice(-PHONE_LENGTH);
}
