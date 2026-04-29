import { Test, TestingModule } from '@nestjs/testing';
import { SessionRotationPolicy } from './session-rotation-policy.service';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';
import type { Request } from 'express';

describe('SessionRotationPolicy', () => {
  let service: SessionRotationPolicy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionRotationPolicy],
    }).compile();

    service = module.get<SessionRotationPolicy>(SessionRotationPolicy);
  });

  describe('shouldRotate', () => {
    it('should rotate after 1 hour has passed since last rotation', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 61 * 60 * 1000), // 61 minutes ago
        ipHash: '192.168.1.1',
      };

      const request: Partial<Request> = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '192.168.1.1',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(true);
    });

    it('should not rotate if less than 1 hour has passed', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        ipHash: '192.168.1.1',
      };

      const request: Partial<Request> = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '192.168.1.1',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(false);
    });

    it('should rotate when IP address changes', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago (not yet 1 hour)
        ipHash: '192.168.1.1', // Original IP
      };

      const request: Partial<Request> = {
        headers: { 'x-forwarded-for': '10.0.0.5' }, // Different IP
        ip: '10.0.0.5',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(true);
    });

    it('should not rotate if IP matches and time elapsed is < 1 hour', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        ipHash: '192.168.1.100',
      };

      const request: Partial<Request> = {
        headers: {},
        ip: '192.168.1.100',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(false);
    });

    it('should handle X-Forwarded-For with multiple IPs (use first)', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        ipHash: '192.168.1.1',
      };

      const request: Partial<Request> = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 10.0.0.2', // Multiple IPs
        },
        ip: '192.168.1.1',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(false);
    });

    it('should rotate if session was never rotated before (lastRotatedAt is null)', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: null, // Never rotated
        ipHash: '192.168.1.1',
      };

      const request: Partial<Request> = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '192.168.1.1',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(true);
    });

    it('should handle boundary case: exactly 1 hour', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 60 * 60 * 1000), // Exactly 1 hour ago
        ipHash: '192.168.1.1',
      };

      const request: Partial<Request> = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '192.168.1.1',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      // At exactly 1 hour, should NOT rotate yet (only > 1 hour triggers rotation)
      expect(shouldRotate).toBe(false);
    });

    it('should handle X-Real-IP header if X-Forwarded-For is absent', () => {
      const session: Partial<UserSession> = {
        lastRotatedAt: new Date(Date.now() - 30 * 60 * 1000),
        ipHash: '203.0.113.5',
      };

      const request: Partial<Request> = {
        headers: { 'x-real-ip': '203.0.113.5' }, // Using X-Real-IP
        ip: '203.0.113.5',
      };

      const shouldRotate = service.shouldRotate(session as UserSession, request as Request);
      expect(shouldRotate).toBe(false);
    });
  });
});
