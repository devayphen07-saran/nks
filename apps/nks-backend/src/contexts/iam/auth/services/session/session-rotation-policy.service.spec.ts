import { Test, TestingModule } from '@nestjs/testing';
import { SessionRotationPolicy } from './session-rotation-policy.service';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';

describe('SessionRotationPolicy', () => {
  let service: SessionRotationPolicy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionRotationPolicy],
    }).compile();

    service = module.get<SessionRotationPolicy>(SessionRotationPolicy);
  });

  describe('shouldRotate', () => {
    it('rotates after 1 hour has passed since last rotation', () => {
      const session = {
        lastRotatedAt: new Date(Date.now() - 61 * 60 * 1000),
      } as UserSession;
      expect(service.shouldRotate(session)).toBe(true);
    });

    it('does not rotate if less than 1 hour has passed', () => {
      const session = {
        lastRotatedAt: new Date(Date.now() - 30 * 60 * 1000),
      } as UserSession;
      expect(service.shouldRotate(session)).toBe(false);
    });

    it('rotates if session was never rotated before (lastRotatedAt is null)', () => {
      const session = { lastRotatedAt: null } as UserSession;
      expect(service.shouldRotate(session)).toBe(true);
    });

    it('does not rotate at exactly 1 hour (strict > comparison)', () => {
      const session = {
        lastRotatedAt: new Date(Date.now() - 60 * 60 * 1000),
      } as UserSession;
      expect(service.shouldRotate(session)).toBe(false);
    });
  });
});
