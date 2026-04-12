/**
 * Log Sanitizer
 * Cross-cutting utility for removing sensitive data from error messages and logs.
 * Extracted from token-validators.ts — this concern belongs independently.
 */

/**
 * Sanitize sensitive data from error messages before logging.
 * Removes: JWT tokens, session tokens, OTPs, emails, phone numbers,
 * UUIDs, device IDs, HMAC hashes, API keys, credit card patterns.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message;

    // Remove Bearer tokens
    message = message.replace(/Bearer\s+[A-Za-z0-9_-]+/g, "[BEARER_TOKEN]");

    // Remove JWT tokens (3-part base64url format)
    message = message.replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[JWT_TOKEN]",
    );

    // Remove opaque session tokens (50-500 char alphanumeric)
    message = message.replace(/\b[A-Za-z0-9_-]{50,500}\b/g, "[SESSION_TOKEN]");

    // Remove OTP codes (6 digits)
    message = message.replace(/\b\d{6}\b/g, "[OTP]");

    // Remove email addresses
    message = message.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[EMAIL]",
    );

    // Remove phone numbers (various formats)
    message = message.replace(
      /\b\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
      "[PHONE]",
    );
    message = message.replace(/\b\d{10,}\b/g, "[PHONE]");

    // Remove UUIDs
    message = message.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[GUUID]",
    );

    // Remove device IDs and hashes
    message = message.replace(
      /deviceId:?\s*[A-Za-z0-9_-]+/gi,
      "deviceId:[DEVICE_ID]",
    );
    message = message.replace(/hash:?\s*[A-Fa-f0-9]{64}/gi, "hash:[HASH]");

    // Remove API keys
    message = message.replace(
      /[Aa]pi[_-]?[Kk]ey\s*[:=]\s*[A-Za-z0-9_-]+/g,
      "apiKey:[API_KEY]",
    );

    // Remove HMAC signatures
    message = message.replace(
      /signature:?\s*[A-Fa-f0-9]{64}/gi,
      "signature:[HMAC]",
    );

    // Remove credit card patterns
    message = message.replace(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      "[CARD]",
    );

    // Generic catch-all for long hex strings
    message = message.replace(/\b[A-Fa-f0-9]{40,}\b/g, "[HEX_DATA]");

    return message;
  }
  return String(error);
}

/**
 * Safe logging wrapper — automatically sanitizes all sensitive data before output.
 */
export const SafeLog = {
  log: (message: string, data?: unknown) => {
    const sanitized = data ? sanitizeError(JSON.stringify(data)) : message;
    console.log(sanitized);
  },

  warn: (message: string, data?: unknown) => {
    const sanitized = data ? sanitizeError(JSON.stringify(data)) : message;
    console.warn(sanitized);
  },

  error: (message: string, data?: unknown) => {
    const sanitized = data ? sanitizeError(JSON.stringify(data)) : message;
    console.error(sanitized);
  },

  debug: (message: string, data?: unknown) => {
    const sanitized = data ? sanitizeError(JSON.stringify(data)) : message;
    console.debug(sanitized);
  },
};
