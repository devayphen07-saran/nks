import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, and, isNotNull } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

type Db = NodePgDatabase<typeof schema>;

/**
 * Refresh Token Service
 *
 * Implements:
 * 1. Refresh token rotation: Each refresh issues a NEW refresh token and revokes the old one
 * 2. Reuse detection: If a revoked token is reused, ALL sessions for that user are terminated
 * 3. Timing-safe comparisons to prevent timing attacks
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  /**
   * Extract sessionId from a refresh token by hashing and looking up in database.
   * Used to identify which session the refresh token belongs to.
   *
   * @param providedRefreshToken - Token provided by client
   * @throws UnauthorizedException if token not found
   * @returns sessionId associated with this refresh token
   */
  async extractSessionIdFromRefreshToken(
    providedRefreshToken: string,
  ): Promise<number> {
    const tokenHash = this.hashToken(providedRefreshToken);
    const session =
      await this.refreshTokenRepository.findByRefreshTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return session.id;
  }

  /**
   * Verify a refresh token and detect reuse/theft.
   *
   * @param sessionId - Session ID (string or number) to check
   * @param providedRefreshToken - Token provided by client
   * @throws UnauthorizedException if token is invalid, expired, or reused
   * @returns userId if valid
   */
  async verifyRefreshToken(
    sessionId: string | number,
    providedRefreshToken: string,
  ): Promise<number> {
    const sessionIdNum =
      typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    const session = await this.refreshTokenRepository.findById(sessionIdNum);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // ─────────────────────────────────────────────────────────────────
    // 1. Check if refresh token is expired
    // ─────────────────────────────────────────────────────────────────
    if (
      session.refreshTokenExpiresAt &&
      session.refreshTokenExpiresAt < new Date()
    ) {
      this.logger.warn(`[RefreshToken] Token expired for session ${sessionId}`);
      throw new UnauthorizedException('Refresh token expired');
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Check if refresh token was already revoked (theft detection)
    // ─────────────────────────────────────────────────────────────────
    if (session.refreshTokenRevokedAt) {
      this.logger.error(
        `[RefreshToken] THEFT DETECTED: Revoked token reused for user ${session.userId}`,
      );

      // Nuke all sessions for this user immediately
      await this.refreshTokenRepository.revokeAllUserSessions(session.userId);

      // Log security event
      await this.logSecurityEvent(
        session.userId,
        'refresh_token_theft_detected',
        {
          sessionId,
          revokedAt: session.refreshTokenRevokedAt,
        },
      );

      throw new UnauthorizedException(
        'Refresh token revoked. All sessions terminated.',
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Verify refresh token hash (timing-safe comparison)
    // ─────────────────────────────────────────────────────────────────
    if (!session.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token not set');
    }

    const providedHash = this.hashToken(providedRefreshToken);
    const isValid = this.timingSafeEqual(
      providedHash,
      session.refreshTokenHash,
    );

    if (!isValid) {
      this.logger.warn(
        `[RefreshToken] Invalid token provided for session ${sessionId}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    return session.userId;
  }

  /**
   * Rotate refresh token: Create new token, revoke old one, return new session.
   *
   * @param sessionId - Session ID (string or number) to rotate
   * @returns New refresh token to send to client
   */
  async rotateRefreshToken(sessionId: string | number): Promise<{
    newSessionId: string | number;
    newRefreshToken: string;
    expiresAt: Date;
  }> {
    const sessionIdNum =
      typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    const session = await this.refreshTokenRepository.findById(sessionIdNum);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // Generate new refresh token (opaque, cryptographically secure)
    const newRefreshToken = this.generateToken();
    const newRefreshTokenHash = this.hashToken(newRefreshToken);
    const newRefreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // SECURITY: Token rotation is handled as a transaction by the repository
    await this.refreshTokenRepository.rotateToken(
      sessionIdNum,
      newRefreshTokenHash,
      newRefreshExpiresAt,
    );

    this.logger.log(
      `[RefreshToken] Token rotated for session ${sessionId}, user ${session.userId}`,
    );

    return {
      newSessionId: sessionId,
      newRefreshToken,
      expiresAt: newRefreshExpiresAt,
    };
  }

  /**
   * Detect if a user has other revoked sessions (potential theft).
   * SECURITY: Helper for token theft detection - returns boolean, not count
   *
   * @param userId - User to check
   * @returns True if user has revoked sessions, false otherwise
   */
  async hasRevokedSessions(userId: number): Promise<boolean> {
    return this.refreshTokenRepository.hasRevokedSessions(userId);
  }

  // ──────────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────

  /**
   * Generate cryptographically secure opaque token (64 chars hex).
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash token using SHA256.
   * Never store plaintext tokens in the database.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Timing-safe comparison to prevent timing attacks.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'hex'),
        Buffer.from(b, 'hex'),
      );
    } catch {
      return false; // If lengths differ, crypto.timingSafeEqual throws
    }
  }

  /**
   * Log security events for audit trail.
   */
  private async logSecurityEvent(
    userId: number,
    eventType: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    // Placeholder: integrate with audit log service
    this.logger.error(
      `[SecurityEvent] ${eventType} for user ${userId}: ${JSON.stringify(metadata)}`,
    );
  }
}
