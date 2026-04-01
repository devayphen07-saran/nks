import * as crypto from "expo-crypto";
import * as jwt from "jsonwebtoken";
import { Logger } from "@/utils/logger";
import { JwksCacheService, JWKSSet } from "./JwksCacheService";
import { TimeSyncService } from "./TimeSyncService";

/**
 * ✅ MODULE 4: JWT Verification Service
 *
 * Purpose:
 * - Verify JWT tokens offline using cached public key
 * - Validate token signature, expiry, issuer, audience
 * - Detect role changes via hash comparison
 * - Enable offline-first mobile operation
 *
 * Flow:
 * 1. Decode token header to get key ID (kid)
 * 2. Get JWKS from cache (auto-fetch if missing)
 * 3. Find matching key in JWKS
 * 4. Verify RSA-256 signature using public key
 * 5. Validate claims (exp, iss, aud)
 * 6. Return verified payload
 */

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  primaryRole: string | null;
  stores: Array<{
    id: number;
    name: string;
  }>;
  activeStoreId: number | null;
  iat: number; // Issued at (seconds)
  exp: number; // Expires at (seconds)
  iss: string; // Issuer
  aud: string; // Audience
  kid?: string; // Key ID
}

export class JwtVerificationService {
  private static readonly logger = new Logger("JwtVerificationService");
  private jwksCacheService: JwksCacheService;
  private timeSyncService: TimeSyncService;

  // Expected values (from Module 1)
  private readonly EXPECTED_ISSUER = "nks-auth";
  private readonly EXPECTED_AUDIENCE = "nks-app";

  constructor(
    jwksCacheService: JwksCacheService,
    timeSyncService: TimeSyncService,
  ) {
    this.jwksCacheService = jwksCacheService;
    this.timeSyncService = timeSyncService;
  }

  /**
   * Verify JWT token completely (signature + claims)
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // Step 1: Decode token header to get key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        throw new Error("Invalid JWT format");
      }

      const kid = decoded.header.kid as string | undefined;
      this.logger.debug(`🔑 Token key ID: ${kid || "none"}`);

      // Step 2: Get JWKS from cache
      const jwks = await this.jwksCacheService.getCachedJwks();

      // Step 3: Find matching key
      const key = this.findKeyInJwks(jwks, kid);
      if (!key) {
        throw new Error(`Key not found in JWKS: ${kid}`);
      }

      // Step 4: Convert JWKS key to PEM format
      const publicKeyPem = await this.jwksToPem(key);

      // Step 5: Verify signature
      const payload = jwt.verify(token, publicKeyPem, {
        algorithms: ["RS256"],
        issuer: this.EXPECTED_ISSUER,
        audience: this.EXPECTED_AUDIENCE,
      }) as JWTPayload;

      // Step 6: Validate expiry with time offset
      this.validateExpiry(payload);

      this.logger.debug(
        `✅ JWT verified successfully. User: ${payload.sub}, Role: ${payload.primaryRole}`,
      );

      return payload;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`JWT verification failed: ${errorMsg}`);
      throw new Error("JWT verification failed: " + errorMsg);
    }
  }

  /**
   * Check if token is expired (using time offset)
   */
  isTokenExpired(payload: JWTPayload): boolean {
    const now = this.timeSyncService.getCurrentTime();
    return payload.exp < now;
  }

  /**
   * Get seconds until token expires
   */
  getSecondsUntilExpiry(payload: JWTPayload): number {
    return payload.exp - this.timeSyncService.getCurrentTime();
  }

  /**
   * Check if token is expiring soon
   */
  isExpiringWithin(payload: JWTPayload, secondsBuffer: number = 300): boolean {
    const secondsUntil = this.getSecondsUntilExpiry(payload);
    return secondsUntil < secondsBuffer && secondsUntil > 0;
  }

  /**
   * Detect if roles have changed by comparing hash
   * Called during sync: compare stored role hash with current token
   */
  detectRoleChange(
    currentPayload: JWTPayload,
    storedRoleHash: string,
  ): boolean {
    const currentHash = this.hashRoles(currentPayload.roles);
    const rolesChanged = currentHash !== storedRoleHash;

    if (rolesChanged) {
      this.logger.warn(
        `🔔 Role change detected! Stored hash: ${storedRoleHash}, Current: ${currentHash}`,
      );
    } else {
      this.logger.debug("✅ Roles unchanged");
    }

    return rolesChanged;
  }

  /**
   * Calculate hash of roles for change detection
   */
  private hashRoles(roles: string[]): string {
    const rolesStr = roles.sort().join("|");
    return crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, rolesStr);
  }

  /**
   * Find key in JWKS by key ID
   */
  private findKeyInJwks(
    jwks: JWKSSet,
    kid?: string,
  ): (typeof jwks.keys)[0] | null {
    if (kid) {
      // Exact match
      return jwks.keys.find((k) => k.kid === kid) || null;
    }

    // No kid in token, use first key (should only be one)
    if (jwks.keys.length > 0) {
      this.logger.warn(
        "No key ID in token, using first key from JWKS (not recommended)",
      );
      return jwks.keys[0];
    }

    return null;
  }

  /**
   * Convert JWKS key to PEM format for verification
   * JWKS keys are in JWK format (base64url encoded components)
   * jwt.verify() needs PEM format
   */
  private async jwksToPem(
    key: (typeof JWKSSet.prototype.keys)[0],
  ): Promise<string> {
    try {
      // For RS256, we need to convert JWK to PEM
      // Using crypto libraries or node-jwk-to-pem
      // For now, using a simplified approach with key components

      // Construct the PEM format RSA public key
      // This requires converting base64url to base64 and properly formatting
      const n = this.base64UrlToBase64(key.n);
      const e = this.base64UrlToBase64(key.e);

      // Create proper PEM header and footer
      const pem = `-----BEGIN PUBLIC KEY-----\n${n}\n-----END PUBLIC KEY-----`;

      return pem;
    } catch (error) {
      this.logger.error("Failed to convert JWK to PEM", error);
      throw new Error("JWK conversion failed");
    }
  }

  /**
   * Convert base64url to base64
   */
  private base64UrlToBase64(str: string): string {
    return str.replace(/-/g, "+").replace(/_/g, "/");
  }

  /**
   * Validate token claims
   */
  private validateExpiry(payload: JWTPayload): void {
    if (!payload.exp) {
      throw new Error("Missing expiry claim (exp)");
    }

    const now = this.timeSyncService.getCurrentTime();
    if (payload.exp < now) {
      const secondsExpired = now - payload.exp;
      throw new Error(`Token expired ${secondsExpired} seconds ago`);
    }
  }

  /**
   * Validate token issuer
   */
  private validateIssuer(payload: JWTPayload): boolean {
    return payload.iss === this.EXPECTED_ISSUER;
  }

  /**
   * Validate token audience
   */
  private validateAudience(payload: JWTPayload): boolean {
    return payload.aud === this.EXPECTED_AUDIENCE;
  }

  /**
   * Get readable error message for verification failure
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof jwt.TokenExpiredError) {
      return "Token has expired";
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return "Invalid token signature";
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown verification error";
  }
}
