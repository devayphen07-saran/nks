import * as crypto from 'crypto';

/** Generate a cryptographically random refresh token and its SHA-256 hex hash. */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/** Hash a refresh token to its SHA-256 hex representation for DB lookup. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Timing-safe comparison of a precomputed hex hash against the stored hash. */
export function verifyRefreshTokenHash(computedHash: string, storedHash: string | null): boolean {
  if (!storedHash || !computedHash) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    // timingSafeEqual throws on length mismatch.
    return false;
  }
}
