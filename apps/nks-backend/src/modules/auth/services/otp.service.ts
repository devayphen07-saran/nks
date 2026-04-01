import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and } from 'drizzle-orm';

const OTP_BCRYPT_ROUNDS = 10;
const OTP_MAX_ATTEMPTS = 5;
import { Msg91Service } from './msg91.service';
import { SendOtpDto, VerifyOtpDto } from '../dto/otp.dto';
import { VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { AuthService } from './auth.service';
import { OtpRateLimitService } from './otp-rate-limit.service';

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

    await this.insertOtpRecord(
      phone,
      'PHONE_VERIFY',
      'MSG91_MANAGED',
      10 * 60 * 1000,
    );

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

    // 5. Record login stats (loginCount, lastLoginAt, lastActiveAt)
    await this.authService.recordSuccessfulLogin(user.id);

    // 6. Return unified auth response
    return this.authService.buildAuthResponse(user, token, expiresAt);
  }

  /**
   * Send OTP to email for verification (onboarding).
   */
  async sendEmailOtp(email: string): Promise<void> {
    // Check rate limit
    await this.rateLimitService.checkAndRecordRequest(email);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash before persisting — the plaintext OTP never touches the database
    const otpHash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);

    // Store hashed OTP record with EMAIL_VERIFY purpose
    await this.insertOtpRecord(
      email,
      'EMAIL_VERIFY',
      otpHash,
      24 * 60 * 60 * 1000,
    );

    // TODO: integrate email delivery service (SendGrid / AWS SES / SMTP)
    // The OTP is intentionally NOT logged — logging it would defeat hashing.
    this.logger.log(`Email OTP generated and stored (hashed) for: ${email}`);
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

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed attempts. Request a new OTP.',
      );
    }

    // Compare provided OTP against the stored bcrypt hash
    const isValid = await bcrypt.compare(otp, otpRecord.value);
    if (!isValid) {
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

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /** Insert an OTP verification record with a computed expiry timestamp. */
  private async insertOtpRecord(
    identifier: string,
    purpose: (typeof schema.otpVerification.$inferInsert)['purpose'],
    value: string,
    expiresInMs: number,
  ): Promise<void> {
    await this.db.insert(schema.otpVerification).values({
      identifier,
      value,
      purpose,
      expiresAt: new Date(Date.now() + expiresInMs),
    });
  }
}
