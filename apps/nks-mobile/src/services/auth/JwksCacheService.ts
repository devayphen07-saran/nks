import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '@/utils/logger';

/**
 * ✅ MODULE 4: JWKS Cache Service
 *
 * Purpose:
 * - Download public key set (JWKS) from backend
 * - Cache locally for offline JWT verification
 * - Auto-refresh on expiry or error
 * - Minimize network calls (cache expires in 24h)
 */

export interface JWKSSet {
  keys: Array<{
    kty: string;      // 'RSA'
    n: string;        // Modulus (base64url)
    e: string;        // Exponent (base64url)
    kid: string;      // Key ID (e.g., '2026-key-1')
    use?: string;     // 'sig' for signing
    alg?: string;     // 'RS256'
  }>;
}

interface JWKSCache {
  jwks: JWKSSet;
  cachedAt: number;         // Timestamp (ms) when fetched
  cacheExpiry: number;      // Timestamp (ms) when it expires
  keyIds: string[];         // Available key IDs
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'jwks_cache';

export class JwksCacheService {
  private static readonly logger = new Logger('JwksCacheService');
  private api: any; // Will be injected

  constructor(api: any) {
    this.api = api;
  }

  /**
   * Get JWKS from cache, or fetch from backend if cache is missing/stale
   */
  async getCachedJwks(): Promise<JWKSSet> {
    try {
      // Try to load from AsyncStorage
      const cached = await this.loadFromStorage();

      if (cached && !this.isCacheStale(cached)) {
        this.logger.debug('✅ JWKS loaded from cache');
        return cached.jwks;
      }

      // Cache missing or stale, fetch from backend
      this.logger.debug('📡 JWKS cache stale or missing, fetching from backend...');
      return await this.fetchAndCacheJwks();
    } catch (error) {
      this.logger.error('Failed to get cached JWKS', error);
      // Try to return stale cache if available
      const cached = await this.loadFromStorage();
      if (cached?.jwks) {
        this.logger.warn('⚠️ Using stale JWKS cache due to error');
        return cached.jwks;
      }
      throw new Error('JWKS unavailable: cannot fetch or cache');
    }
  }

  /**
   * Download JWKS from backend and cache it
   */
  async fetchAndCacheJwks(): Promise<JWKSSet> {
    try {
      const response = await this.api.get('/.well-known/jwks.json');
      const jwks = response.data.data; // Extract from ApiResponse wrapper

      // Extract key IDs from the response
      const keyIds = jwks.keys?.map((k: any) => k.kid) || [];

      // Create cache entry
      const cache: JWKSCache = {
        jwks,
        cachedAt: Date.now(),
        cacheExpiry: Date.now() + CACHE_DURATION_MS,
        keyIds,
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));

      this.logger.debug(
        `✅ JWKS cached successfully. Keys: ${keyIds.join(', ')}`
      );

      return jwks;
    } catch (error) {
      this.logger.error('Failed to fetch JWKS from backend', error);
      throw new Error('Cannot fetch JWKS: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Force refresh JWKS cache
   */
  async refreshJwks(): Promise<JWKSSet> {
    this.logger.debug('🔄 Forcing JWKS refresh...');
    await this.clearCache();
    return await this.fetchAndCacheJwks();
  }

  /**
   * Check if cache exists and is not stale
   */
  private isCacheStale(cache: JWKSCache): boolean {
    const now = Date.now();
    const isStale = now > cache.cacheExpiry;

    if (isStale) {
      const ageHours = (now - cache.cachedAt) / (60 * 60 * 1000);
      this.logger.debug(`⏰ JWKS cache is stale (${ageHours.toFixed(1)}h old)`);
    }

    return isStale;
  }

  /**
   * Load JWKS cache from AsyncStorage
   */
  private async loadFromStorage(): Promise<JWKSCache | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Failed to load JWKS from storage', error);
      return null;
    }
  }

  /**
   * Clear JWKS cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      this.logger.debug('✅ JWKS cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear JWKS cache', error);
    }
  }

  /**
   * Get available key IDs from cache
   */
  async getAvailableKeyIds(): Promise<string[]> {
    const cache = await this.loadFromStorage();
    return cache?.keyIds || [];
  }

  /**
   * Get cache metadata (age, expiry)
   */
  async getCacheMetadata(): Promise<{
    cachedAt: number;
    cacheExpiry: number;
    ageSeconds: number;
    isStale: boolean;
  } | null> {
    const cache = await this.loadFromStorage();
    if (!cache) return null;

    const now = Date.now();
    return {
      cachedAt: cache.cachedAt,
      cacheExpiry: cache.cacheExpiry,
      ageSeconds: Math.floor((now - cache.cachedAt) / 1000),
      isStale: this.isCacheStale(cache),
    };
  }
}
