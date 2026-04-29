import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';

/**
 * SessionRotationPolicy — Encapsulates the business logic for deciding
 * when a session token should be rotated.
 *
 * Extracted from SessionRotationInterceptor to enable independent testing
 * without NestJS request context.
 *
 * Rotation triggers:
 * 1. Time-based: >1 hour since last rotation
 * 2. Event-based: IP address change detected
 */
@Injectable()
export class SessionRotationPolicy {
  /**
   * Determine if a session should be rotated based on time and IP changes.
   * Pure business logic with no HTTP dependencies — fully testable.
   *
   * @param session Current session record with lastRotatedAt and ipHash
   * @param request Express request with headers and ip
   * @returns true if rotation should occur, false otherwise
   */
  shouldRotate(session: UserSession, request: Request): boolean {
    // Time-based rotation: > 1 hour since last rotation
    const hoursSinceRotation = this.getHoursSinceRotation(session.lastRotatedAt);
    if (hoursSinceRotation > 1) {
      return true;
    }

    // Event-based rotation: IP address changed
    if (this.hasIpChanged(session.ipHash, request)) {
      return true;
    }

    return false;
  }

  /**
   * Get hours elapsed since last rotation.
   * @param lastRotatedAt Last rotation timestamp
   * @returns Hours as decimal (e.g., 1.5 = 1.5 hours)
   */
  private getHoursSinceRotation(lastRotatedAt: Date | null): number {
    if (!lastRotatedAt) {
      return Infinity;  // Never rotated yet
    }

    const elapsedMs = Date.now() - lastRotatedAt.getTime();
    return elapsedMs / (60 * 60 * 1000);
  }

  /**
   * Check if client IP has changed since last session creation.
   * @param sessionIpHash Stored IP hash from session creation
   * @param request Current request
   * @returns true if IP differs, false if same
   */
  private hasIpChanged(sessionIpHash: string | null, request: Request): boolean {
    if (!sessionIpHash) {
      return false;  // No previous IP stored (shouldn't happen, but be safe)
    }

    const currentIp = this.extractClientIp(request);
    return currentIp !== sessionIpHash;
  }

  /**
   * Extract client IP from request, considering proxies and load balancers.
   * Checks headers in order: X-Forwarded-For, X-Real-IP, req.ip
   * @param request Express request
   * @returns IP address string
   */
  private extractClientIp(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      // X-Forwarded-For can contain multiple IPs; use the first (client IP)
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIp = request.headers['x-real-ip'];
    if (typeof xRealIp === 'string') {
      return xRealIp.trim();
    }

    return request.ip || '0.0.0.0';
  }
}