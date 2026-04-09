import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SessionsRepository } from '../repositories/sessions.repository';
import type { UserSession, NewUserSession } from '../../../core/database/schema/auth/user-session';

/** Device type enum — must match sessionDeviceTypeEnum in database */
enum DeviceTypeEnum {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

/** Authentication method enum — must match authMethodEnum in database */
enum AuthMethodEnum {
  OTP = 'OTP',
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
}

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
}

export interface SessionCreateInput extends DeviceInfo {
  userId: number;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  loginMethod?: string;
}

export interface PublicSession {
  id: number;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  expiresAt: Date;
  createdAt: Date;
}

const MAX_SESSIONS_PER_USER = 10;

/** Validate and normalize device type to database enum */
function validateDeviceType(
  deviceType?: string,
): DeviceTypeEnum | undefined {
  if (!deviceType) return undefined;
  if (Object.values(DeviceTypeEnum).includes(deviceType as DeviceTypeEnum)) {
    return deviceType as DeviceTypeEnum;
  }
  throw new BadRequestException(
    `Invalid device type: ${deviceType}. Must be one of: ${Object.values(DeviceTypeEnum).join(', ')}`,
  );
}

/** Validate and normalize login method to database enum */
function validateLoginMethod(
  loginMethod?: string,
): AuthMethodEnum | undefined {
  if (!loginMethod) return undefined;
  if (Object.values(AuthMethodEnum).includes(loginMethod as AuthMethodEnum)) {
    return loginMethod as AuthMethodEnum;
  }
  throw new BadRequestException(
    `Invalid login method: ${loginMethod}. Must be one of: ${Object.values(AuthMethodEnum).join(', ')}`,
  );
}

/**
 * SessionService
 * Responsible for session lifecycle management
 * Responsibilities:
 * - Create sessions with device tracking
 * - Retrieve active sessions
 * - Terminate sessions
 * - Enforce session limits
 * - Clean up expired sessions
 * - Mark sessions for token rotation
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly sessionsRepository: SessionsRepository) {}

  /**
   * Create a new session for a user
   * Enforces session limit and removes oldest if needed
   */
  async createSession(input: SessionCreateInput): Promise<UserSession> {
    // Enforce session limit
    await this.enforceSessionLimit(input.userId);

    // Validate and normalize enum values
    const validatedDeviceType = validateDeviceType(input.deviceType);
    const validatedLoginMethod = validateLoginMethod(input.loginMethod);

    // Create session
    const session = await this.sessionsRepository.create({
      userId: input.userId,
      token: input.token,
      expiresAt: input.expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      deviceType: validatedDeviceType,
      platform: input.platform,
      appVersion: input.appVersion,
      loginMethod: validatedLoginMethod,
    } as NewUserSession);

    this.logger.debug(
      `Session created for user ${input.userId} (device: ${input.deviceName})`,
    );

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<PublicSession[]> {
    const sessions = await this.sessionsRepository.findActiveByUserId(userId);
    return sessions.map(this.toPublicSession);
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: number): Promise<UserSession | null> {
    return this.sessionsRepository.findById(sessionId);
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<UserSession | null> {
    return this.sessionsRepository.findByToken(token);
  }

  /**
   * Invalidate a session (logout from specific device)
   */
  async invalidateSession(sessionId: number): Promise<void> {
    await this.sessionsRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  /**
   * Invalidate session by token
   */
  async invalidateSessionByToken(token: string): Promise<void> {
    const session = await this.sessionsRepository.findByToken(token);
    if (session) {
      await this.invalidateSession(session.id);
    }
  }

  /**
   * Terminate a specific session (admin/user action)
   */
  async terminateSession(userId: number, sessionId: number): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.userId !== userId) {
      throw new BadRequestException('Cannot terminate other user sessions');
    }

    await this.invalidateSession(sessionId);
    this.logger.debug(`Session terminated by user: ${sessionId}`);
  }

  /**
   * Terminate all sessions for a user (logout everywhere)
   */
  async terminateAllSessions(userId: number): Promise<number> {
    const count = await this.sessionsRepository.deleteAllForUser(userId);
    this.logger.debug(`All sessions terminated for user ${userId}: ${count}`);
    return count;
  }

  /**
   * Mark session refresh token as rotated
   */
  async markTokenRotated(sessionId: number): Promise<void> {
    await this.sessionsRepository.markAsRotated(sessionId);
  }

  /**
   * Revoke refresh token (theft detection)
   */
  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.sessionsRepository.revokeRefreshToken(sessionId);
  }

  /**
   * Set active store for session
   */
  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.sessionsRepository.setActiveStore(sessionId, storeId);
    this.logger.debug(
      `Active store set for session ${sessionId}: ${storeId}`,
    );
  }

  /**
   * Clean up expired sessions (scheduled task)
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.sessionsRepository.deleteExpired();
    this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
    return { deletedCount };
  }

  /**
   * Enforce session limit per user
   * If user has MAX_SESSIONS, remove oldest before creating new one
   */
  private async enforceSessionLimit(userId: number): Promise<void> {
    const activeSessions = await this.sessionsRepository.findActiveByUserId(
      userId,
    );

    if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      const oldest = activeSessions[0];
      await this.sessionsRepository.delete(oldest.id);
      this.logger.debug(
        `Session limit enforced: removed oldest for user ${userId}`,
      );
    }
  }

  /**
   * Convert internal session to public format (hide sensitive data)
   */
  private toPublicSession(session: UserSession): PublicSession {
    return {
      id: session.id,
      deviceId: session.deviceId ?? undefined,
      deviceName: session.deviceName ?? undefined,
      deviceType: session.deviceType ?? undefined,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}
