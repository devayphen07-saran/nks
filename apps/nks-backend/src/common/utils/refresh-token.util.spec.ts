import * as crypto from 'crypto';
import { generateRefreshToken, hashRefreshToken, verifyRefreshTokenHash } from './refresh-token.util';

describe('refresh-token.util', () => {
  describe('generateRefreshToken', () => {
    it('returns a token and tokenHash', () => {
      const result = generateRefreshToken();
      expect(typeof result.token).toBe('string');
      expect(typeof result.tokenHash).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.tokenHash.length).toBe(64);
    });

    it('produces a token whose SHA256 matches the returned hash', () => {
      const { token, tokenHash } = generateRefreshToken();
      const expected = crypto.createHash('sha256').update(token).digest('hex');
      expect(tokenHash).toBe(expected);
    });

    it('produces a unique token on each invocation', () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a.token).not.toBe(b.token);
      expect(a.tokenHash).not.toBe(b.tokenHash);
    });

    it('produces base64url-encoded token (no +, /, or =)', () => {
      const { token } = generateRefreshToken();
      expect(token).not.toMatch(/[+/=]/);
    });
  });

  describe('verifyRefreshTokenHash', () => {
    it('returns true when precomputed hash matches stored hash', () => {
      const { token, tokenHash } = generateRefreshToken();
      const hash = hashRefreshToken(token);
      expect(verifyRefreshTokenHash(hash, tokenHash)).toBe(true);
    });

    it('returns false when hashes do not match', () => {
      const { tokenHash } = generateRefreshToken();
      const { token: otherToken } = generateRefreshToken();
      const hash = hashRefreshToken(otherToken);
      expect(verifyRefreshTokenHash(hash, tokenHash)).toBe(false);
    });

    it('returns false when storedHash is null', () => {
      const { token } = generateRefreshToken();
      const hash = hashRefreshToken(token);
      expect(verifyRefreshTokenHash(hash, null)).toBe(false);
    });

    it('returns false when computedHash is empty', () => {
      const { tokenHash } = generateRefreshToken();
      expect(verifyRefreshTokenHash('', tokenHash)).toBe(false);
    });

    it('returns false when storedHash length differs from computed hash', () => {
      const { token } = generateRefreshToken();
      const hash = hashRefreshToken(token);
      expect(verifyRefreshTokenHash(hash, 'abc123')).toBe(false);
    });
  });
});
