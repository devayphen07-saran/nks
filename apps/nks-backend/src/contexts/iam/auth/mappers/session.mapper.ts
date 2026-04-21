import type { UserSession } from '../../../../core/database/schema/auth/user-session';
import type { PublicSession } from '../services/session/session.service';

/**
 * Session Mapper
 *
 * Transforms internal UserSession entities to public-facing DTOs
 * Hides sensitive data (refresh tokens, session tokens, etc.)
 */
export class SessionMapper {
  /**
   * Convert internal session to public format (hide sensitive data)
   */
  static toPublicSession(session: UserSession): PublicSession {
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
