/**
 * JWTManager — Dual-token manager for offline-first mobile auth.
 *
 * Manages three tokens:
 *   - accessToken   (RS256, 15 min)  — used for API calls when online
 *   - offlineToken  (RS256, 3 days)  — used as authorization proof offline
 *   - refreshToken  (opaque, 7 days) — exchanges for new access + offline tokens
 *
 * Offline window is determined entirely by the offline token's own `exp` claim.
 * No client-side grace period math is needed.
 *
 * Boundary with tokenManager (@nks/mobile-utils):
 *   - tokenManager  — manages the opaque BetterAuth session token used as the
 *                     Authorization header for all backend API calls. It does NOT
 *                     know about JWT structure or offline auth.
 *   - JWTManager    — manages RS256 JWTs for local validation and offline POS.
 *                     It is completely independent of the HTTP layer.
 *
 * Use tokenManager.get() when calling the API. Use JWTManager when making
 * offline write-guard or expiry decisions.
 *
 * Storage keys follow the `auth.*` namespace in SecureStore (see storage-keys.ts).
 */

import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { createLogger } from "./logger";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { STORAGE_KEYS } from "./storage-keys";

const log = createLogger("JWTManager");

// JWKS in-memory cache TTL: 1 hour — fast emergency key rotation propagation
const JWKS_TTL_MS = 60 * 60 * 1000;

// Maximum age for a stale JWKS fallback: 7 days.
// The backend key rotation grace period is 30 days, but we use 7 days as a
// conservative margin. If the cached key is older than this, we cannot safely
// verify tokens offline — skip verification and rely solely on the offline
// session's own expiry/signature instead of potentially using a revoked key.
const JWKS_STALE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type OfflineMode =
  | "online"           // Device is online (access token in use)
  | "offline_valid"    // Offline, offline token still valid
  | "offline_warning"  // Offline, < 12h remaining on offline token
  | "offline_expired"; // Offline token expired — writes blocked, re-login required

export interface OfflineStatus {
  mode: OfflineMode;
  offlineExpiresAt: number | null;   // Unix epoch ms
  remainingMs: number | null;        // null if expired
}

interface TokenSet {
  accessToken: string | null;
  offlineToken: string | null;
  refreshToken: string | null;
}

interface JwksCache {
  publicKey: string;
  kid?: string;
  cachedAt: number;
}

// ─── Internal state ──────────────────────────────────────────────────────────

let _tokens: TokenSet = {
  accessToken: null,
  offlineToken: null,
  refreshToken: null,
};

let _jwksCache: JwksCache | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeExpMs(token: string): number | null {
  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Validates that a hydrated JWKS cache entry has the expected shape and
 * plausible content. Catches corrupted SecureStore reads before they cause
 * opaque failures in offline JWT verification.
 */
function isValidJwksCache(data: JwksCache): boolean {
  if (typeof data.publicKey !== "string" || data.publicKey.length === 0) {
    return false;
  }
  // Must look like a PEM key or a base64-encoded key
  if (
    !data.publicKey.includes("BEGIN") &&
    !/^[A-Za-z0-9+/=]+$/.test(data.publicKey.substring(0, 50))
  ) {
    return false;
  }
  if (typeof data.cachedAt !== "number" || data.cachedAt <= 0 || isNaN(data.cachedAt)) {
    return false;
  }
  return true;
}

// ─── JWTManager ──────────────────────────────────────────────────────────────

export const JWTManager = {
  /**
   * Hydrates all tokens + JWKS from SecureStore into memory.
   * Call this once during app startup before any auth checks.
   */
  async hydrate(): Promise<void> {
    const [access, offline, refresh, jwksCacheRaw, jwksCachedAt, jwksKid] =
      await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.JWT_ACCESS_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.JWT_OFFLINE_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.JWT_REFRESH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.JWKS_CACHE),
        SecureStore.getItemAsync(STORAGE_KEYS.JWKS_CACHED_AT),
        SecureStore.getItemAsync(STORAGE_KEYS.JWKS_KID),
      ]);

    _tokens = {
      accessToken: access,
      offlineToken: offline,
      refreshToken: refresh,
    };

    if (jwksCacheRaw && jwksCachedAt) {
      const candidate: JwksCache = {
        publicKey: jwksCacheRaw,
        kid: jwksKid ?? undefined,
        cachedAt: parseInt(jwksCachedAt, 10),
      };

      if (isValidJwksCache(candidate)) {
        _jwksCache = candidate;
      } else {
        log.warn("Corrupted JWKS cache detected — clearing");
        _jwksCache = null;
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_CACHE),
          SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_CACHED_AT),
          SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_KID),
        ]).catch(() => {});
      }
    }

    const hasOffline = !!offline;
    const offlineExpMs = offline ? decodeExpMs(offline) : null;
    log.info(
      `Hydrated — access:${!!access} offline:${hasOffline} ` +
        `offlineExp:${offlineExpMs ? new Date(offlineExpMs).toISOString() : "none"}`,
    );
  },

  /**
   * Persists all three tokens to SecureStore and updates in-memory state.
   */
  async persistTokens(tokens: {
    accessToken: string;
    offlineToken: string;
    refreshToken: string;
  }): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.JWT_ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(STORAGE_KEYS.JWT_OFFLINE_TOKEN, tokens.offlineToken),
      SecureStore.setItemAsync(STORAGE_KEYS.JWT_REFRESH_TOKEN, tokens.refreshToken),
    ]);

    _tokens = {
      accessToken: tokens.accessToken,
      offlineToken: tokens.offlineToken,
      refreshToken: tokens.refreshToken,
    };

    log.info("Tokens persisted");
  },

  /**
   * Returns the current offline status synchronously (reads in-memory state).
   * Use this for UI rendering and write-guard decisions.
   */
  getOfflineStatus(): OfflineStatus {
    const token = _tokens.offlineToken;

    if (!token) {
      return { mode: "offline_expired", offlineExpiresAt: null, remainingMs: null };
    }

    const expMs = decodeExpMs(token);
    if (!expMs) {
      return { mode: "offline_expired", offlineExpiresAt: null, remainingMs: null };
    }

    const now = Date.now();
    const remainingMs = expMs - now;

    if (remainingMs <= 0) {
      return { mode: "offline_expired", offlineExpiresAt: expMs, remainingMs: 0 };
    }

    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const mode: OfflineMode =
      remainingMs < TWELVE_HOURS_MS ? "offline_warning" : "offline_valid";

    return { mode, offlineExpiresAt: expMs, remainingMs };
  },

  /**
   * Fetches and caches the NKS RS256 JWKS public key.
   * Falls back to stale cache if request fails.
   */
  async cacheJWKS(baseUrl: string): Promise<boolean> {
    // Return cached if still fresh
    if (_jwksCache && Date.now() - _jwksCache.cachedAt < JWKS_TTL_MS) {
      log.debug(`Using cached JWKS (age: ${Math.round((Date.now() - _jwksCache.cachedAt) / 1000)}s)`);
      return true;
    }

    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/api/v1/auth/mobile-jwks`,
        { headers: { Accept: "application/json" } },
        10_000,
      );

      if (!res.ok) {
        throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
      }

      const jwks = await res.json();

      if (!jwks?.keys?.length) {
        throw new Error("Empty JWKS keys array");
      }

      const rsaKey = jwks.keys.find(
        (k: { kty?: string; use?: string }) =>
          k.kty === "RSA" && k.use === "sig",
      );

      if (!rsaKey?.pem && !rsaKey?.publicKey) {
        throw new Error("No RS256 key with pem/publicKey field in JWKS");
      }

      const publicKey: string = rsaKey.pem ?? rsaKey.publicKey;
      const kid: string | undefined = rsaKey.kid;
      const cachedAt = Date.now();

      _jwksCache = { publicKey, kid, cachedAt };

      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.JWKS_CACHE, publicKey),
        SecureStore.setItemAsync(STORAGE_KEYS.JWKS_CACHED_AT, String(cachedAt)),
        ...(kid ? [SecureStore.setItemAsync(STORAGE_KEYS.JWKS_KID, kid)] : []),
      ]);

      log.info(`JWKS cached (kid: ${kid ?? "none"})`);
      return true;
    } catch (err) {
      log.warn("JWKS fetch failed, using stale cache:", err);
      if (!_jwksCache) return false;
      if (Date.now() - _jwksCache.cachedAt > JWKS_STALE_LIMIT_MS) {
        log.warn(
          `Stale JWKS cache is older than 7 days — skipping verification. ` +
          `Rely on offline session expiry/signature only.`,
        );
        return false;
      }
      return true;
    }
  },

  /**
   * Clears all tokens from memory and SecureStore.
   * Call on logout or revocation.
   */
  async clear(): Promise<void> {
    _tokens = { accessToken: null, offlineToken: null, refreshToken: null };
    _jwksCache = null;

    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWT_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWT_OFFLINE_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWT_REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_CACHE),
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_CACHED_AT),
      SecureStore.deleteItemAsync(STORAGE_KEYS.JWKS_KID),
    ]).catch(() => {});

    log.info("All tokens cleared");
  },

  /** Returns the raw access token string (for direct use). */
  getRawAccessToken(): string | null {
    return _tokens.accessToken;
  },
};
