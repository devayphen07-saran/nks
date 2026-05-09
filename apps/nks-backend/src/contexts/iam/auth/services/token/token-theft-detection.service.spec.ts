import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TokenTheftDetectionService, Session } from './token-theft-detection.service';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { SessionEvents } from '../../../../../common/events/session.events';

describe('TokenTheftDetectionService', () => {
  let service: TokenTheftDetectionService;
  let auditService: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    auditService = { log: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenTheftDetectionService,
        { provide: AuditCommandService, useValue: auditService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<TokenTheftDetectionService>(TokenTheftDetectionService);
  });

  describe('detectAndHandleTheft', () => {
    it('returns false when refreshTokenRevokedAt is null (no theft)', () => {
      const session: Session = { id: 1, userId: 42, refreshTokenRevokedAt: null };
      expect(service.detectAndHandleTheft(session)).toBe(false);
    });

    it('does not log audit when no theft detected', () => {
      const session: Session = { id: 1, userId: 42, refreshTokenRevokedAt: null };
      service.detectAndHandleTheft(session);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('does not emit event when no theft detected', () => {
      const session: Session = { id: 1, userId: 42, refreshTokenRevokedAt: null };
      service.detectAndHandleTheft(session);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('returns true when refreshTokenRevokedAt is set (theft detected)', () => {
      const session: Session = { id: 1, userId: 42, refreshTokenRevokedAt: new Date() };
      expect(service.detectAndHandleTheft(session)).toBe(true);
    });

    it('logs to audit trail with critical severity on theft', () => {
      const revokedAt = new Date();
      const session: Session = { id: 7, userId: 42, refreshTokenRevokedAt: revokedAt };

      service.detectAndHandleTheft(session);

      expect(auditService.log).toHaveBeenCalledTimes(1);
      const call = auditService.log.mock.calls[0][0];
      expect(call.action).toBe('TOKEN_REVOKE');
      expect(call.userId).toBe(42);
      expect(call.severity).toBe('critical');
      expect(call.resourceType).toBe('session');
      expect(call.resourceId).toBe(7);
      expect(call.metadata.reason).toBe('TOKEN_THEFT_DETECTED');
      expect(call.metadata.sessionId).toBe(7);
      expect(call.metadata.revokedAt).toBe(revokedAt);
    });

    it('emits REVOKE_ALL_FOR_USER event with TOKEN_REUSE reason', () => {
      const session: Session = { id: 7, userId: 42, refreshTokenRevokedAt: new Date() };
      service.detectAndHandleTheft(session);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(SessionEvents.REVOKE_ALL_FOR_USER, {
        userId: 42,
        reason: 'TOKEN_REUSE',
      });
    });
  });
});