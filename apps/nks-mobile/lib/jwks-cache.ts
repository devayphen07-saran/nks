import { API } from "@nks/api-manager";
import { saveSecureItem, getSecureItem, deleteSecureItem } from "@nks/mobile-utils";
import { ONE_HOUR_MS } from "@nks/utils";
import { STORAGE_KEYS } from "./storage-keys";

/**
 * JWKS Cache with TTL and key rotation detection.
 * 1-hour in-memory TTL ensures fast emergency key rotation propagation.
 * Falls back to SecureStore if the network is unavailable.
 */

const JWKS_CACHE_TTL_MS = ONE_HOUR_MS;

interface JwksCacheEntry {
  publicKey: string;
  keyId?: string;
  cachedAt: number;
  isExpired(): boolean;
  isRotated(newKeyId?: string): boolean;
}

let cachedEntry: JwksCacheEntry | null = null;

/**
 * Fetches the JWKS public key from the backend.
 * Used for offline JWT verification (RS256 signature validation).
 *
 * @param preferredKid Optional key ID from a JWT header. When provided, the matching
 *   key is selected from the JWKS set. Falls back to the first RS256 signing key
 *   if no match is found, so rotation doesn't hard-fail existing sessions.
 */
export async function fetchJwksPublicKey(preferredKid?: string): Promise<string> {
  try {
    // Use cached entry if still valid and kid matches (or no kid preference)
    if (cachedEntry && !cachedEntry.isExpired()) {
      const kidMatches = !preferredKid || cachedEntry.keyId === preferredKid;
      if (kidMatches) {
        console.log(
          `[JWKS] Using cached key (${Math.round((Date.now() - cachedEntry.cachedAt) / 1000)}s old)`,
        );
        return cachedEntry.publicKey;
      }
    }

    console.log("[JWKS] Fetching public key from server...");
    const response = await API.get("/.well-known/jwks.json");
    const jwks = response.data;

    if (!jwks.keys || jwks.keys.length === 0) {
      throw new Error("No keys found in JWKS response");
    }

    // Prefer the key matching the JWT's kid header, then fall back to first RS256 key.
    // This handles multi-key JWKS sets correctly after key rotation.
    const rsaKey =
      (preferredKid &&
        jwks.keys.find(
          (key: any) =>
            key.kty === "RSA" && key.use === "sig" && key.kid === preferredKid,
        )) ||
      jwks.keys.find((key: any) => key.kty === "RSA" && key.use === "sig");

    if (!rsaKey) {
      throw new Error("No RS256 signing key found in JWKS");
    }

    const newKeyId = rsaKey.kid;
    const oldKeyId = cachedEntry?.keyId;

    if (oldKeyId && newKeyId && cachedEntry && cachedEntry.isRotated(newKeyId)) {
      console.warn(`[JWKS] Key rotation detected! Old: ${oldKeyId}, New: ${newKeyId}`);
    }

    const pem = rsaKey.pem || rsaKey.publicKey;
    if (!pem) {
      throw new Error("Public key (pem/publicKey field) not found in JWKS response");
    }

    cachedEntry = {
      publicKey: pem,
      keyId: newKeyId,
      cachedAt: Date.now(),
      isExpired() {
        return Date.now() - this.cachedAt > JWKS_CACHE_TTL_MS;
      },
      isRotated(kid?: string) {
        return Boolean(this.keyId && kid && this.keyId !== kid);
      },
    };

    await saveSecureItem(STORAGE_KEYS.JWKS_PUBLIC_KEY, pem);
    await saveSecureItem(STORAGE_KEYS.JWKS_CACHE_TIME, String(Date.now()));
    if (newKeyId) {
      await saveSecureItem(STORAGE_KEYS.JWKS_KID, newKeyId);
    }

    console.log(`[JWKS] Key cached successfully (TTL: 1h, KID: ${newKeyId})`);
    return pem;
  } catch (error) {
    // Fallback to stale SecureStore cache — allows offline JWT verification
    console.warn(
      "[JWKS] Fetch failed, attempting stale cache fallback:",
      error instanceof Error ? error.message : String(error),
    );

    try {
      const cachedKey = await getSecureItem(STORAGE_KEYS.JWKS_PUBLIC_KEY);
      if (cachedKey) {
        console.log("[JWKS] Using stale cached key from SecureStore");
        cachedEntry = {
          publicKey: cachedKey,
          cachedAt: 0,
          isExpired() {
            return true;
          },
          isRotated() {
            return false;
          },
        };
        return cachedKey;
      }
    } catch (fallbackError) {
      console.debug(
        "[JWKS] SecureStore fallback also failed:",
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch JWKS public key and no fallback available: ${message}`);
  }
}

/**
 * Clears the JWKS cache — call on logout or key rotation detection.
 */
export async function clearJwksCache(): Promise<void> {
  cachedEntry = null;
  await Promise.all([
    deleteSecureItem(STORAGE_KEYS.JWKS_PUBLIC_KEY),
    deleteSecureItem(STORAGE_KEYS.JWKS_CACHE_TIME),
    deleteSecureItem(STORAGE_KEYS.JWKS_KID),
  ]).catch(() => {});
  console.log("[JWKS] Cache cleared");
}

/**
 * Get cache status for debugging.
 */
export function getJwksCacheStatus(): {
  isCached: boolean;
  isExpired: boolean;
  ageSeconds: number;
  ttlSeconds: number;
  keyId?: string;
} {
  if (!cachedEntry) {
    return {
      isCached: false,
      isExpired: true,
      ageSeconds: 0,
      ttlSeconds: JWKS_CACHE_TTL_MS / 1000,
    };
  }

  return {
    isCached: true,
    isExpired: cachedEntry.isExpired(),
    ageSeconds: Math.round((Date.now() - cachedEntry.cachedAt) / 1000),
    ttlSeconds: JWKS_CACHE_TTL_MS / 1000,
    keyId: cachedEntry.keyId,
  };
}
