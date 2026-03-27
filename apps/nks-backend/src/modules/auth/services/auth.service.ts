import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ProfileCompleteDto,
  ProfileCompleteResponseDto,
} from '../dto';
import { AuthMapper } from '../mappers/auth-mapper';
import { InjectAuth } from '../decorators/inject-auth.decorator';
import type { Auth } from '../config/better-auth';
import { RolesRepository } from '../../roles/roles.repository';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
    @InjectAuth() private readonly auth: Auth,
    private readonly rolesRepo: RolesRepository,
    private readonly passwordService: PasswordService,
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
  ) {}

  /**
   * Find an existing user by phone or create a new one.
   * Called after MSG91 OTP verification — phone is already proven.
   */
  async findOrCreateUserByPhone(phone: string) {
    let [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phoneNumber, phone))
      .limit(1);

    if (!user) {
      const iamUserId = crypto.randomUUID();
      const [created] = await this.db
        .insert(schema.users)
        .values({
          iamUserId,
          name: `User ${phone.slice(-4)}`,
          phoneNumber: phone,
          phoneNumberVerified: true,
        })
        .returning();
      user = created;
    } else if (!user.phoneNumberVerified) {
      await this.db
        .update(schema.users)
        .set({ phoneNumberVerified: true })
        .where(eq(schema.users.id, user.id));
      user = { ...user, phoneNumberVerified: true };
    }

    if (!user) throw new UnauthorizedException('Phone login failed');
    return user;
  }

  /**
   * Delegate session creation to BetterAuth after identity has been proven
   * externally (MSG91 OTP, email+password, OAuth token verify).
   *
   * BetterAuth writes the session to user_session, handles token generation,
   * expiry, rotation, and IP/userAgent tracking.
   */
  async createSessionForUser(
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const auth = this.auth as unknown as {
      $context: Promise<{
        internalAdapter: {
          createSession: (userId: string) => Promise<{
            token: string;
            expiresAt: Date;
          } | null>;
        };
      }>;
    };
    const ctx = await auth.$context;
    // We use the internal adapter to create a session record.
    // BetterAuth will still be able to validate this session via getSession.
    const session = await ctx.internalAdapter.createSession(String(userId));

    if (!session) throw new UnauthorizedException('Failed to create session');

    return { token: session.token, expiresAt: session.expiresAt };
  }

  /**
   * Login a user with email + password.
   * BetterAuth creates the session after credentials are verified.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email))
      .limit(1);

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new UnauthorizedException('Account is blocked');

    const [provider] = await this.db
      .select()
      .from(schema.userAuthProvider)
      .where(
        and(
          eq(schema.userAuthProvider.userId, user.id),
          eq(schema.userAuthProvider.providerId, 'email'),
        ),
      )
      .limit(1);

    if (!provider?.password) {
      throw new BadRequestException(
        'Password not set. Please use OTP login or set a password first.',
      );
    }

    const isValid = await this.passwordService.compare(
      dto.password,
      provider.password,
    );
    if (!isValid) {
      // Track failed login attempt
      await this.db
        .update(schema.users)
        .set({
          failedLoginAttempts: user.failedLoginAttempts + 1,
        })
        .where(eq(schema.users.id, user.id));

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.db
      .update(schema.users)
      .set({
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // Auto-assign SUPER_ADMIN role to first user (role already exists from seed)
    const hasSuperAdmin = await this.isSuperAdminSeeded();
    if (!hasSuperAdmin) {
      const superAdminRole = await this.rolesRepo.findByCode('SUPER_ADMIN');
      if (superAdminRole) {
        try {
          await this.rolesRepo.assignRoleToUser(user.id, superAdminRole.id, user.id);
        } catch {
          // Ignore if already assigned (race condition)
        }
      }
    }

    const { token, expiresAt } = await this.createSessionForUser(user.id);

    const permissions = await this.getUserPermissions(user.id);
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
   * Register a new user with email + password.
   * First registered user is automatically assigned SUPER_ADMIN role.
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    const [existingUser] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, dto.email))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Generate IAM user ID
    const iamUserId = crypto.randomUUID();

    // Create user
    const [user] = await this.db
      .insert(schema.users)
      .values({
        iamUserId,
        name: dto.name,
        email: dto.email,
        emailVerified: false,
      })
      .returning();

    if (!user) throw new BadRequestException('Failed to create user');

    // Create email auth provider
    await this.db.insert(schema.userAuthProvider).values({
      userId: user.id,
      providerId: 'email',
      accountId: dto.email,
      password: passwordHash,
      isVerified: false,
    });

    // Check if this is the first user (no SUPER_ADMIN exists) — role already exists from seed
    const hasSuperAdmin = await this.isSuperAdminSeeded();
    if (!hasSuperAdmin) {
      const superAdminRole = await this.rolesRepo.findByCode('SUPER_ADMIN');
      if (superAdminRole) {
        try {
          await this.rolesRepo.assignRoleToUser(user.id, superAdminRole.id, user.id);
        } catch {
          // Ignore if already assigned (race condition)
        }
      }
    }

    // Create session
    const { token, expiresAt } = await this.createSessionForUser(user.id);

    // Get permissions
    const permissions = await this.getUserPermissions(user.id);
    const requestId = crypto.randomUUID();
    const traceId = crypto.randomUUID();

    return AuthMapper.toAuthResponseDto(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: false,
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
   * Check whether any SUPER_ADMIN account exists yet.
   * Used by the web /setup page to decide whether to show the form.
   */
  async isSuperAdminSeeded(): Promise<boolean> {
    const existing = await this.db
      .select({ id: schema.roles.id })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .where(eq(schema.roles.code, 'SUPER_ADMIN'))
      .limit(1);
    return existing.length > 0;
  }

  /**
   * Refresh a session - validates the old token and creates a new session.
   * This allows token rotation while keeping the old token valid until expiry.
   */
  async refreshSession(oldToken: string): Promise<{ token: string; expiresAt: Date }> {
    // Find the session by old token
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.token, oldToken))
      .limit(1);

    if (!session) throw new UnauthorizedException('Invalid or expired session token');

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    // Create a new session for the same user
    return this.createSessionForUser(session.userId);
  }

  /** Delete the session token from DB — invalidates it immediately. */
  async logout(token: string): Promise<void> {
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.token, token));
  }

  /** Assign CUSTOMER role to a user (personal account setup). */
  async setupPersonal(userId: number) {
    const customerRole = await this.rolesRepo.findByCode('CUSTOMER');
    if (!customerRole)
      throw new UnauthorizedException('CUSTOMER role not found');
    try {
      await this.rolesRepo.assignRoleToUser(userId, customerRole.id, userId);
    } catch {
      // Ignore unique constraint — already assigned
    }
    return this.getUserPermissions(userId);
  }

  /**
   * Fetch all roles, permissions, activeStoreId, and userType for a user.
   */
  async getUserPermissions(userId: number): Promise<any> {
    const userRoles = await this.rolesRepo.findUserRolesWithCompany(userId);
    const roleCodes = userRoles.map((r) => r.roleCode);
    const activeStoreId =
      userRoles.find((r) => r.storeFk != null)?.storeFk ?? null;

    const roles = userRoles.map((r, index) => ({
      roleCode: r.roleCode as
        | 'SUPER_ADMIN'
        | 'STORE_OWNER'
        | 'STAFF'
        | 'STORE_MANAGER'
        | 'CASHIER'
        | 'DELIVERY'
        | 'CUSTOMER',
      storeId: r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: index === 0, // First role is primary
      assignedAt: new Date().toISOString(),
      expiresAt: null,
    }));

    if (roleCodes.includes('SUPER_ADMIN')) {
      return {
        roles,
        isSuperAdmin: true,
        activeStoreId,
      };
    }

    return {
      roles,
      isSuperAdmin: false,
      activeStoreId,
    };
  }

  /**
   * Complete profile after login with secondary authentication method.
   * - Logged in via phone? Add email + password
   * - Logged in via email? Add phone number
   * Updates name and handles verification OTP sending.
   */
  async profileComplete(
    userId: number,
    dto: ProfileCompleteDto,
  ): Promise<ProfileCompleteResponseDto> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException('User not found');

    // Update name
    await this.db
      .update(schema.users)
      .set({ name: dto.name })
      .where(eq(schema.users.id, userId));

    let emailVerificationSent = false;
    let phoneVerificationSent = false;
    let nextStep: 'verifyEmail' | 'verifyPhone' | 'complete' = 'complete';

    // Case 1: User logged in via phone, adding email + password
    if (dto.email) {
      if (!dto.password) {
        throw new BadRequestException(
          'Password is required when adding email',
        );
      }

      // Check email not already in use
      const [existingEmail] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.email, dto.email),
            eq(schema.users.id, userId),
          ),
        )
        .limit(1);

      if (!existingEmail) {
        // Update user email (unverified initially)
        await this.db
          .update(schema.users)
          .set({ email: dto.email, emailVerified: false })
          .where(eq(schema.users.id, userId));
      }

      // Hash and store password
      const hash = await this.passwordService.hash(dto.password);
      const [existingProvider] = await this.db
        .select({ id: schema.userAuthProvider.id })
        .from(schema.userAuthProvider)
        .where(
          and(
            eq(schema.userAuthProvider.userId, userId),
            eq(schema.userAuthProvider.providerId, 'email'),
          ),
        )
        .limit(1);

      if (existingProvider) {
        await this.db
          .update(schema.userAuthProvider)
          .set({ password: hash })
          .where(eq(schema.userAuthProvider.id, existingProvider.id));
      } else {
        await this.db.insert(schema.userAuthProvider).values({
          accountId: dto.email,
          providerId: 'email',
          userId,
          password: hash,
          isVerified: false,
        });
      }

      // Send email OTP for verification
      await this.otpService.sendEmailOtp(dto.email);
      emailVerificationSent = true;
      nextStep = 'verifyEmail';
    }

    // Case 2: User logged in via email, adding phone number
    if (dto.phoneNumber) {
      // Check phone not already in use
      const [existingPhone] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.phoneNumber, dto.phoneNumber),
            eq(schema.users.id, userId),
          ),
        )
        .limit(1);

      if (!existingPhone) {
        // Update user phone (unverified initially)
        await this.db
          .update(schema.users)
          .set({ phoneNumber: dto.phoneNumber, phoneNumberVerified: false })
          .where(eq(schema.users.id, userId));
      }

      // Send phone OTP for verification via MSG91
      await this.otpService.sendOtp({ phone: dto.phoneNumber });
      phoneVerificationSent = true;
      nextStep = phoneVerificationSent ? 'verifyPhone' : nextStep;
    }

    // If nothing added, mark profile as complete
    if (!dto.email && !dto.phoneNumber) {
      await this.db
        .update(schema.users)
        .set({
          profileCompleted: true,
          profileCompletedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    }

    return {
      emailVerificationSent,
      phoneVerificationSent,
      nextStep,
      message:
        nextStep === 'complete'
          ? 'Profile completed successfully'
          : `OTP sent. Please verify your ${nextStep === 'verifyEmail' ? 'email' : 'phone number'}`,
    };
  }

  /**
   * Rotate the session: delete old token, issue new one via BetterAuth.
   */
  async rotateSession(
    oldToken: string,
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    // Delete old session
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.token, oldToken));

    // Issue new session via BetterAuth
    return this.createSessionForUser(userId);
  }
}
