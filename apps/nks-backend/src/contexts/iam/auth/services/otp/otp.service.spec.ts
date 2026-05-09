import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { OtpRepository } from '../../repositories/otp.repository';
import { AuthProviderRepository } from '../../repositories/auth-provider.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { TransactionService } from '../../../../../core/database/transaction.service';
import { OtpDeliveryService } from './otp-delivery.service';
import { Msg91Service } from '../providers/msg91.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import {
  BadRequestException,
  UnauthorizedException,
} from '../../../../../common/exceptions';
import { ErrorCode } from '../../../../../common/constants/error-codes.constants';

const validOtpRecord = (overrides: Partial<any> = {}) => ({
  id: 1,
  identifier: '+919876543210',
  purpose: 'PHONE_VERIFY',
  isUsed: false,
  expiresAt: new Date(Date.now() + 60_000),
  value: 'hashed-otp',
  attempts: 0,
  ...overrides,
});

describe('OtpService', () => {
  let service: OtpService;
  let otpRepo: { findByIdentifierPurposeAndReqId: jest.Mock; findByIdentifierAndPurpose: jest.Mock; markAsUsedByReqId: jest.Mock; markAsUsed: jest.Mock; incrementAttempts: jest.Mock };
  let authProvider: { findIdByUserIdAndProvider: jest.Mock; updateVerification: jest.Mock; create: jest.Mock };
  let usersRepo: { findByEmail: jest.Mock; verifyEmail: jest.Mock };
  let tx: { run: jest.Mock };
  let delivery: { sendSmsOtp: jest.Mock; sendEmailOtp: jest.Mock; resendSmsOtp: jest.Mock; verifyOtpHash: jest.Mock };
  let msg91: { verifyOtp: jest.Mock };
  let rateLimit: { enforceMinVerifyGap: jest.Mock; resetRequestCount: jest.Mock };

  beforeEach(async () => {
    otpRepo = {
      findByIdentifierPurposeAndReqId: jest.fn(),
      findByIdentifierAndPurpose: jest.fn(),
      markAsUsedByReqId: jest.fn().mockResolvedValue(true),
      markAsUsed: jest.fn().mockResolvedValue(true),
      incrementAttempts: jest.fn(),
    };
    authProvider = {
      findIdByUserIdAndProvider: jest.fn(),
      updateVerification: jest.fn(),
      create: jest.fn(),
    };
    usersRepo = { findByEmail: jest.fn(), verifyEmail: jest.fn() };
    tx = { run: jest.fn().mockImplementation(async (cb) => cb({})) };
    delivery = {
      sendSmsOtp: jest.fn().mockResolvedValue({ reqId: 'req-1', mobile: '+919876543210' }),
      sendEmailOtp: jest.fn().mockResolvedValue(undefined),
      resendSmsOtp: jest.fn().mockResolvedValue({ reqId: 'req-2', mobile: '+919876543210' }),
      verifyOtpHash: jest.fn().mockReturnValue(true),
    };
    msg91 = { verifyOtp: jest.fn().mockResolvedValue({ type: 'success' }) };
    rateLimit = {
      enforceMinVerifyGap: jest.fn().mockResolvedValue(undefined),
      resetRequestCount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: OtpRepository, useValue: otpRepo },
        { provide: AuthProviderRepository, useValue: authProvider },
        { provide: AuthUsersRepository, useValue: usersRepo },
        { provide: TransactionService, useValue: tx },
        { provide: OtpDeliveryService, useValue: delivery },
        { provide: Msg91Service, useValue: msg91 },
        { provide: OtpRateLimitService, useValue: rateLimit },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('sendOtp', () => {
    it('delegates to delivery.sendSmsOtp with phone', async () => {
      const result = await service.sendOtp({ phone: '+919876543210' } as any);
      expect(delivery.sendSmsOtp).toHaveBeenCalledWith('+919876543210');
      expect(result.reqId).toBe('req-1');
    });
  });

  describe('verifyOtp', () => {
    const dto = { phone: '+919876543210', otp: '123456', reqId: 'req-1' };

    it('returns verified=true on the happy path', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(validOtpRecord());
      const result = await service.verifyOtp(dto as any);
      expect(result).toEqual({ verified: true, phone: '+919876543210' });
    });

    it('throws OTP_NOT_FOUND when record missing', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(null);
      let err: BadRequestException | undefined;
      try { await service.verifyOtp(dto as any); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.OTP_NOT_FOUND);
    });

    it('throws OTP_ALREADY_USED when record already used', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(validOtpRecord({ isUsed: true }));
      let err: BadRequestException | undefined;
      try { await service.verifyOtp(dto as any); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.OTP_ALREADY_USED);
    });

    it('throws OTP_EXPIRED when expiry passed', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(
        validOtpRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );
      let err: BadRequestException | undefined;
      try { await service.verifyOtp(dto as any); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.OTP_EXPIRED);
    });

    it('throws when MSG91 verify response is non-success', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(validOtpRecord());
      msg91.verifyOtp.mockResolvedValue({ type: 'error', message: 'wrong otp' });
      await expect(service.verifyOtp(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws OTP_ALREADY_USED when CAS mark-as-used loses race (rotated=false)', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(validOtpRecord());
      otpRepo.markAsUsedByReqId.mockResolvedValue(false);
      let err: BadRequestException | undefined;
      try { await service.verifyOtp(dto as any); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.OTP_ALREADY_USED);
    });

    it('enforces minimum verify gap (rate limit) before MSG91 call', async () => {
      otpRepo.findByIdentifierPurposeAndReqId.mockResolvedValue(validOtpRecord());
      const callOrder: string[] = [];
      rateLimit.enforceMinVerifyGap.mockImplementation(async () => { callOrder.push('rateLimit'); });
      msg91.verifyOtp.mockImplementation(async () => { callOrder.push('msg91'); return { type: 'success' }; });
      await service.verifyOtp(dto as any);
      expect(callOrder).toEqual(['rateLimit', 'msg91']);
    });
  });

  describe('sendEmailOtp', () => {
    it('throws AUTH_EMAIL_NOT_SET when email is null', async () => {
      let err: BadRequestException | undefined;
      try { await service.sendEmailOtp(null); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.AUTH_EMAIL_NOT_SET);
    });

    it('delegates to delivery.sendEmailOtp when email is present', async () => {
      await service.sendEmailOtp('a@b.com');
      expect(delivery.sendEmailOtp).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('verifyEmailOtp', () => {
    const dto = { email: 'a@b.com', otp: '123456' };

    it('throws OTP_NOT_FOUND when record missing', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(null);
      await expect(service.verifyEmailOtp(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws OTP_MAX_ATTEMPTS_EXCEEDED when attempts at max', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord({ attempts: 5 }));
      let err: BadRequestException | undefined;
      try { await service.verifyEmailOtp(dto as any); } catch (e) { err = e as any; }
      expect(err?.code).toBe(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED);
    });

    it('increments attempts and throws OTP_INVALID when hash mismatch', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      delivery.verifyOtpHash.mockReturnValue(false);
      await expect(service.verifyEmailOtp(dto as any)).rejects.toThrow(BadRequestException);
      expect(otpRepo.incrementAttempts).toHaveBeenCalledWith(1);
    });

    it('throws when CAS mark-as-used loses race', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      otpRepo.markAsUsed.mockResolvedValue(false);
      await expect(service.verifyEmailOtp(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws when user lookup fails', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      usersRepo.findByEmail.mockResolvedValue(null);
      await expect(service.verifyEmailOtp(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws USER_BLOCKED when user is blocked', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      usersRepo.findByEmail.mockResolvedValue({ id: 42, isBlocked: true });
      await expect(service.verifyEmailOtp(dto as any)).rejects.toThrow(UnauthorizedException);
    });

    it('updates existing email auth provider verification when one exists', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      usersRepo.findByEmail.mockResolvedValue({ id: 42, isBlocked: false });
      authProvider.findIdByUserIdAndProvider.mockResolvedValue(7);

      await service.verifyEmailOtp(dto as any);

      expect(authProvider.updateVerification).toHaveBeenCalledWith(7, true, expect.any(Date), expect.anything());
      expect(authProvider.create).not.toHaveBeenCalled();
    });

    it('creates email auth provider when none exists', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      usersRepo.findByEmail.mockResolvedValue({ id: 42, isBlocked: false });
      authProvider.findIdByUserIdAndProvider.mockResolvedValue(null);

      await service.verifyEmailOtp(dto as any);

      expect(authProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42, providerId: 'email', accountId: 'a@b.com', isVerified: true }),
        expect.anything(),
      );
    });

    it('marks user email as verified and resets rate limit on success', async () => {
      otpRepo.findByIdentifierAndPurpose.mockResolvedValue(validOtpRecord());
      usersRepo.findByEmail.mockResolvedValue({ id: 42, isBlocked: false });
      authProvider.findIdByUserIdAndProvider.mockResolvedValue(7);

      await service.verifyEmailOtp(dto as any);

      expect(usersRepo.verifyEmail).toHaveBeenCalledWith(42, expect.anything());
      expect(rateLimit.resetRequestCount).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('resendOtp', () => {
    it('delegates to delivery.resendSmsOtp', async () => {
      const result = await service.resendOtp('req-1');
      expect(delivery.resendSmsOtp).toHaveBeenCalledWith('req-1');
      expect(result.reqId).toBe('req-2');
    });
  });
});