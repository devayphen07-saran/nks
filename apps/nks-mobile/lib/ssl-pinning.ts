/**
 * SSL Public Key Pinning — prevents MITM attacks by rejecting TLS connections
 * whose server certificate doesn't match a known public key hash.
 *
 * HOW TO GENERATE PIN HASHES:
 *   # Extract from a live server:
 *   openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com 2>/dev/null \
 *     | openssl x509 -pubkey -noout \
 *     | openssl pkey -pubin -outform der \
 *     | openssl dgst -sha256 -binary \
 *     | base64
 *
 *   # Or from a PEM file:
 *   openssl x509 -in cert.pem -pubkey -noout \
 *     | openssl pkey -pubin -outform der \
 *     | openssl dgst -sha256 -binary \
 *     | base64
 *
 * IMPORTANT:
 *   - Always include at least 2 pins per domain (primary + backup) on iOS.
 *   - Set EXPO_PUBLIC_SSL_PIN_1 and EXPO_PUBLIC_SSL_PIN_2 in your .env file.
 *   - Pins expire on expirationDate — update before then or all users will be blocked.
 *   - Not available in Expo Go — gracefully skipped when native module is absent.
 */

import {
  initializeSslPinning,
  isSslPinningAvailable,
  addSslPinningErrorListener,
} from "react-native-ssl-public-key-pinning";
import { createLogger } from "./logger";

const log = createLogger("SSLPinning");

// Derive domain from EXPO_PUBLIC_API_URL
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const apiDomain = (() => {
  try {
    return new URL(apiUrl).hostname;
  } catch {
    return "localhost";
  }
})();

// Pin hashes — set via environment variables for security
// Generate with: openssl s_client | openssl x509 | openssl pkey -pubin | openssl dgst -sha256 -binary | base64
const PIN_1 = process.env.EXPO_PUBLIC_SSL_PIN_1 ?? "";
const PIN_2 = process.env.EXPO_PUBLIC_SSL_PIN_2 ?? "";

// Pin expiration — rotate before this date
const PIN_EXPIRATION = process.env.EXPO_PUBLIC_SSL_PIN_EXPIRY ?? "2026-12-31";

/**
 * Initializes SSL pinning for the API domain.
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 *
 * Skips gracefully when:
 *   - Running in Expo Go (native module not available)
 *   - On localhost (development)
 *   - No pin hashes configured
 */
export async function initializePinning(): Promise<void> {
  // Skip in Expo Go or if native module unavailable
  if (!isSslPinningAvailable()) {
    log.info("SSL pinning not available (Expo Go) — skipping");
    return;
  }

  // Skip localhost — no certificate to pin
  if (apiDomain === "localhost" || apiDomain === "127.0.0.1") {
    log.info("Localhost detected — skipping SSL pinning for development");
    return;
  }

  // Skip if no pins configured
  const pins = [PIN_1, PIN_2].filter(Boolean);
  if (pins.length === 0) {
    log.warn(
      "No SSL pins configured (EXPO_PUBLIC_SSL_PIN_1 / EXPO_PUBLIC_SSL_PIN_2). " +
        "Set these in .env for production builds.",
    );
    return;
  }

  try {
    await initializeSslPinning({
      [apiDomain]: {
        includeSubdomains: true,
        publicKeyHashes: pins,
        expirationDate: PIN_EXPIRATION,
      },
    });

    log.info(`SSL pinning enabled for ${apiDomain} (${pins.length} pin(s), expires ${PIN_EXPIRATION})`);

    // Log pinning failures — useful for detecting MITM attempts or expired certs
    addSslPinningErrorListener((error) => {
      log.error(`SSL pinning failure for ${error.serverHostname}: ${error.message ?? "unknown"}`);
    });
  } catch (err) {
    log.error("Failed to initialize SSL pinning:", err);
    // Don't throw — pinning failure should not block app launch in development.
    // In production, consider throwing here to enforce the security requirement.
  }
}
