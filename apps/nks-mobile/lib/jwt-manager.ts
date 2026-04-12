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
 * Storage keys follow the `auth.*` namespace in SecureStore.
 */

import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { createLogger } from "./logger";
import { fetchWithTimeout } from "./fetch-with-timeout";

const log = createLogger("JWTManager");

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN: "auth.jwt.access",
  OFFLINE_TOKEN: "auth.jwt.offline",
  REFRESH_TOKEN: "auth.jwt.refresh",
  JWKS_CACHE: "auth.jwks.cache",
  JWKS_CACHED_AT: "auth.jwks.cached_at",
  JWKS_KID: "auth.jwks.kid",
} as const;

// JWKS in-memory cache TTL: 1 hour — fast emergency key rotation propagation
const JWKS_TTL_MS = 60 * 60 * 1000;

// Access token proactive refresh threshold: 3 minutes before expiry
const ACCESS_REFRESH_THRESHOLD_MS = 3 * 60 * 1000;

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

function isAccessTokenExpired(): boolean {
  if (!_tokens.accessToken) return true;
  const expMs = decodeExpMs(_tokens.accessToken);
  if (!expMs) return true;
  return Date.now() >= expMs - ACCESS_REFRESH_THRESHOLD_MS;
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
        SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(KEYS.OFFLINE_TOKEN),
        SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(KEYS.JWKS_CACHE),
        SecureStore.getItemAsync(KEYS.JWKS_CACHED_AT),
        SecureStore.getItemAsync(KEYS.JWKS_KID),
      ]);

    _tokens = {
      accessToken: access,
      offlineToken: offline,
      refreshToken: refresh,
    };

    if (jwksCacheRaw && jwksCachedAt) {
      _jwksCache = {
        publicKey: jwksCacheRaw,
        kid: jwksKid ?? undefined,
        cachedAt: parseInt(jwksCachedAt, 10),
      };
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
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(KEYS.OFFLINE_TOKEN, tokens.offlineToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, tokens.refreshToken),
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
   * Returns a valid access token.
   * - If online and access token is not expired: returns cached access token.
   * - If online and access token is near-expiry: attempts refresh.
   * - If offline: returns the offline token for authorization proof.
   */
  async getAccessToken(isOnline: boolean): Promise<string | null> {
    if (!isOnline) {
      return _tokens.offlineToken;
    }

    if (!isAccessTokenExpired() && _tokens.accessToken) {
      return _tokens.accessToken;
    }

    // Access token expired or near-expiry — attempt refresh
    log.info("Access token near-expiry, refreshing...");
    const result = await JWTManager.refreshFromServer();
    return result ? _tokens.accessToken : null;
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
        SecureStore.setItemAsync(KEYS.JWKS_CACHE, publicKey),
        SecureStore.setItemAsync(KEYS.JWKS_CACHED_AT, String(cachedAt)),
        ...(kid ? [SecureStore.setItemAsync(KEYS.JWKS_KID, kid)] : []),
      ]);

      log.info(`JWKS cached (kid: ${kid ?? "none"})`);
      return true;
    } catch (err) {
      log.warn("JWKS fetch failed, using stale cache:", err);
      return !!_jwksCache; // true if we have a stale fallback
    }
  },

  /**
   * Returns the cached JWKS public key (PEM string) for offline verification.
   */
  getCachedPublicKey(): string | null {
    return _jwksCache?.publicKey ?? null;
  },

  /**
   * Calls POST /api/auth/refresh to get new access + offline + refresh tokens.
   * Updates in-memory state and SecureStore on success.
   *
   * Returns true on success, false on network/server failure.
   * Throws on 401/403 (refresh token invalid — caller must logout).
   */
  async refreshFromServer(baseUrl?: string): Promise<boolean> {
    if (!_tokens.refreshToken) {
      log.warn("No refresh token available");
      return false;
    }

    try {
      const url = baseUrl
        ? `${baseUrl}/api/auth/refresh-token`
        : "/api/auth/refresh-token";

      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: _tokens.refreshToken }),
        },
        15_000,
      );

      if (res.status === 401 || res.status === 403) {
        log.warn(`Refresh rejected by server: ${res.status}`);
        throw new Error("REFRESH_TOKEN_INVALID");
      }

      if (!res.ok) {
        log.warn(`Refresh server error: ${res.status}`);
        return false;
      }

      const body = await res.json();
      // Backend returns: { data: { jwtToken, refreshToken, offlineToken, ... } }
      const data = body?.data ?? body;

      const accessToken: string | undefined =
        data?.jwtToken ?? data?.accessToken;
      const refreshToken: string | undefined = data?.refreshToken;
      const offlineToken: string | undefined = data?.offlineToken;

      if (!accessToken || !refreshToken || !offlineToken) {
        log.warn("Refresh response missing required tokens", {
          hasAccess: !!accessToken,
          hasRefresh: !!refreshToken,
          hasOffline: !!offlineToken,
        });
        return false;
      }

      await JWTManager.persistTokens({ accessToken, refreshToken, offlineToken });
      log.info("Tokens refreshed successfully");
      return true;
    } catch (err) {
      if (err instanceof Error && err.message === "REFRESH_TOKEN_INVALID") {
        throw err; // Re-throw so caller can logout
      }
      log.error("Refresh request failed:", err);
      return false;
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
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.OFFLINE_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.JWKS_CACHE),
      SecureStore.deleteItemAsync(KEYS.JWKS_CACHED_AT),
      SecureStore.deleteItemAsync(KEYS.JWKS_KID),
    ]).catch(() => {});

    log.info("All tokens cleared");
  },

  /** Returns the raw offline token string (for header injection). */
  getOfflineToken(): string | null {
    return _tokens.offlineToken;
  },

  /** Returns the raw access token string (for direct use). */
  getRawAccessToken(): string | null {
    return _tokens.accessToken;
  },

  /** Returns the raw refresh token string. */
  getRefreshToken(): string | null {
    return _tokens.refreshToken;
  },
};
