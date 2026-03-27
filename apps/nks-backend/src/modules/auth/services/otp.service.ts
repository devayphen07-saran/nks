import { Injectable, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and } from 'drizzle-orm';
import { Msg91Service } from './msg91.service';
import { SendOtpDto, VerifyOtpDto } from '../dto/otp.dto';
import { VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { AuthService } from './auth.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { AuthMapper } from '../mappers/auth-mapper';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly msg91: Msg91Service,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly rateLimitService: OtpRateLimitService,
  ) {}

  /**
   * Send OTP via MSG91 and log the attempt for rate limiting.
   */
  async sendOtp(dto: SendOtpDto) {
    const { phone } = dto;

    // Check rate limit
    await this.rateLimitService.checkAndRecordRequest(phone);

    const response = await this.msg91.sendOtp(phone);

    await this.db.insert(schema.otpVerification).values({
      identifier: phone,
      value: 'MSG91_MANAGED',
      purpose: 'PHONE_VERIFY',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return response;
  }

  /**
   * Verify OTP via MSG91.
   * On success, identity is proven → BetterAuth issues the session token.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const { phone, otp, reqId } = dto;

    // 1. Verify with MSG91
    const response = await this.msg91.verifyOtp(reqId, otp);
    if (response?.type !== 'success') {
      throw new BadRequestException(response?.message || 'Invalid OTP');
    }

    // 2. Mark OTP log as used
    await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(
        and(
          eq(schema.otpVerification.identifier, phone),
          eq(schema.otpVerification.isUsed, false),
          eq(schema.otpVerification.purpose, 'PHONE_VERIFY'),
        ),
      );

    // 3. Find or create user (phone is now proven)
    const user = await this.authService.findOrCreateUserByPhone(phone);

    // 4. BetterAuth creates the session token
    const { token, expiresAt } = await this.authService.createSessionForUser(
      user.id,
    );

    // 5. Return unified auth response
    const permissions = await this.authService.getUserPermissions(user.id);
    const requestId = crypto.randomUUID();
    const traceId = crypto.randomUUID();

    return AuthMapper.toAuthResponseDto(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image,
          phoneNumber: user.phoneNumber,
          phoneNumberVerified: user.phoneNumberVerified,
          lastLoginAt: new Date(),
          lastLoginIp: null,
        },
        token,
        session: { token, expiresAt, sessionId: crypto.randomUUID() },
      },
      permissions,
      requestId,
      traceId,
    );
  }

  /**
   * Send OTP to email for verification (onboarding).
   */
  async sendEmailOtp(email: string): Promise<void> {
    // Check rate limit
    await this.rateLimitService.checkAndRecordRequest(email);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP record with EMAIL_VERIFY purpose
    await this.db.insert(schema.otpVerification).values({
      identifier: email,
      value: otp, // In production, hash this before storing
      purpose: 'EMAIL_VERIFY',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // TODO: Send email with OTP (implement email service)
    this.logger.debug(`Email OTP for ${email}: ${otp}`);
  }

  /**
   * Verify email OTP and link auth provider.
   * Called after user enters OTP during email verification in onboarding.
   */
  async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<void> {
    const { email, otp } = dto;

    // Find active OTP record
    const [otpRecord] = await this.db
      .select()
      .from(schema.otpVerification)
      .where(
        and(
          eq(schema.otpVerification.identifier, email),
          eq(schema.otpVerification.purpose, 'EMAIL_VERIFY'),
          eq(schema.otpVerification.isUsed, false),
        ),
      )
      .limit(1);

    if (!otpRecord) {
      throw new BadRequestException('OTP expired or not found');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.attempts >= 5) {
      throw new BadRequestException(
        'Too many failed attempts. Request a new OTP.',
      );
    }

    // Check OTP value (in production, compare hashes)
    if (otpRecord.value !== otp) {
      await this.db
        .update(schema.otpVerification)
        .set({ attempts: otpRecord.attempts + 1 })
        .where(eq(schema.otpVerification.id, otpRecord.id));

      throw new BadRequestException('Invalid OTP');
    }

    // Mark OTP as used
    await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(eq(schema.otpVerification.id, otpRecord.id));

    // Find user by email
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Create or update email auth provider
    const [existing] = await this.db
      .select()
      .from(schema.userAuthProvider)
      .where(
        and(
          eq(schema.userAuthProvider.userId, user.id),
          eq(schema.userAuthProvider.providerId, 'email'),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.userAuthProvider)
        .set({
          isVerified: true,
          verifiedAt: new Date(),
        })
        .where(eq(schema.userAuthProvider.id, existing.id));
    } else {
      await this.db.insert(schema.userAuthProvider).values({
        userId: user.id,
        providerId: 'email',
        accountId: email,
        isVerified: true,
        verifiedAt: new Date(),
      });
    }

    // Sync to users table
    await this.db
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.id, user.id));

    // Reset rate limit counter
    await this.rateLimitService.resetRequestCount(email);
  }

  /**
   * Retry OTP delivery.
   */
  async retryOtp() {
    return this.msg91.retryOtp();
  }
}
