import { Injectable, Logger } from '@nestjs/common';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';

/**
 * SessionRotationPolicy — pure business logic for the rolling-rotation decision.
 *
 * Extracted from SessionRotationInterceptor to enable independent testing
 * without NestJS request context.
 *
 * Rotation trigger: > 1 hour since last rotation.
 */
@Injectable()
export class SessionRotationPolicy {
  private readonly logger = new Logger(SessionRotationPolicy.name);

  shouldRotate(session: UserSession): boolean {
    return this.getHoursSinceRotation(session.lastRotatedAt) > 1;
  }

  private getHoursSinceRotation(lastRotatedAt: Date | null): number {
    if (!lastRotatedAt) return Infinity; // never rotated yet
    return (Date.now() - lastRotatedAt.getTime()) / (60 * 60 * 1000);
  }
}
