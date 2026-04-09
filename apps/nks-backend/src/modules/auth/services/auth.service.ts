import * as crypto from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { EmailValidator, PasswordValidator } from './validators';
import { SanitizerValidator } from '../../../common/validators/sanitizer.validator';
import {
  LoginDto,
  RegisterDto,
  AuthResponseEnvelope,
  ProfileCompleteDto,
  ProfileCompleteResponseDto,
  SessionInfoDto,
} from '../dto';
import {
  AuthMapper,
  type UserRoleEntry,
  type PermissionContext,
  type TokenPair,
} from '../mapper/auth-mapper';
import type { PermissionsSnapshot } from './permissions.service';
import type { SessionUserRole } from '../interfaces/session-user.interface';
import { InjectAuth } from '../decorators/inject-auth.decorator';
import type { Auth } from '../config/better-auth';
import { RolesRepository } from '../../roles/roles.repository';
import { AuthUsersRepository } from '../repositories/auth-users.repository';
import { AuthProviderRepository } from '../repositories/auth-provider.repository';
import { SessionsRepository } from '../repositories/sessions.repository';
import { SessionService } from './session.service';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { PermissionsService } from './permissions.service';
import { JWTConfigService } from '../../../config/jwt.config';
import { RoutesService } from '../../routes/routes.service';
import { AuditService, AuditEventType } from '../../audit/audit.service';

type Db = NodePgDatabase<typeof schema>;

// BetterAuth internal interface for session creation
interface BetterAuthInternal {
  $context: Promise<{
    internalAdapter: {
      createSession: (userId: string) => Promise<{
        token: string;
        expiresAt: Date;
      } | null>;
    };
  }>;
}

// JWT verification response
export interface VerifyClaimsResponse {
  isValid: boolean;
  sub?: string;
  rolesChanged: boolean;
  currentRoles?: string[];
  stores?: Array<{ id: number | null; name: string | null }>;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SYSTEM_ROLE_STORE_OWNER = 'STORE_OWNER';
const JWT_AUDIENCE = 'nks-app';
const REFRESH_TOKEN_HMAC_SECRET =
  process.env['REFRESH_TOKEN_HMAC_SECRET'] || 'default-refresh-token-secret';
const IP_HMAC_SECRET =
  process.env['IP_HMAC_SECRET'] || 'default-ip-hmac-secret';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    @InjectAuth() private readonly auth: Auth,
    private readonly rolesRepository: RolesRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly sessionService: SessionService,
    private readonly passwordService: PasswordService,
    private readonly otpService: OtpService,
    private readonly permissionsService: PermissionsService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly routesService: RoutesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Safely access BetterAuth internal context for session operations.
   * BetterAuth's public API doesn't expose $context, so we access the internal property.
   * This is required for direct database session creation/deletion.
   */
  private async getBetterAuthContext() {
    return (this.auth as unknown as BetterAuthInternal).$context;
  }

  async findUserByPhone(
    phone: string,
  ): Promise<typeof schema.users.$inferSelect | null> {
    return this.authUsersRepository.findByPhone(phone);
  }

  /**
   * Find an existing user by phone or create a new one.
   * Called after MSG91 OTP verification — phone is already proven.
   */
  async findOrCreateUserByPhone(
    phone: string,
  ): Promise<typeof schema.users.$inferSelect> {
    let user = await this.authUsersRepository.findByPhone(phone);

    if (!user) {
      // Create new user with phone number
      user = await this.authUsersRepository.create({
        name: `User ${phone.slice(-4)}`,
        phoneNumber: phone,
        phoneNumberVerified: false,
        iamUserId: crypto.randomUUID(),
      });

      if (!user) {
        throw new Error('Failed to create user in database');
      }
    }

    // Mark phone as verified after MSG91 OTP verification
    if (!user.phoneNumberVerified) {
      await this.authUsersRepository.verifyPhone(user.id);
      user = { ...user, phoneNumberVerified: true };
      this.logger.log(
        `Phone number verified via MSG91 OTP for user ${user.id}: ${phone.slice(-4)}`,
      );
    }

    return user;
  }

  /**
   * Delegate session creation to BetterAuth after identity has been proven
   * externally (MSG91 OTP, email+password, OAuth token verify).
   *
  
  
  
  
   */
  async createSessionForUser(
    userId: number,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<{
    token: string;
    expiresAt: Date;
    sessionGuuid: string;
    jwtToken?: string;
    userRoles: SessionUserRole[];
    userEmail: string;
  }> {
    const ctx = await this.getBetterAuthContext();
    const session = await ctx.internalAdapter.createSession(String(userId));

    if (!session) throw new UnauthorizedException('Failed to create session');

    // Fetch and embed roles in session + JWT
    try {
      const permissions = await this.getUserPermissions(userId);
      const userRoles = permissions.roles || [];
      const primaryRole = userRoles[0]?.roleCode || null;

      // Get user guuid + email for JWT
      const user = await this.authUsersRepository.findEmailAndGuuid(userId);

      // Calculate and store role hash for detecting changes
      const roleHash = this.hashRoles(userRoles);

      // Sign JWT after session update so sid (session guuid) is available
      // jwtToken is overwritten by createTokenPair() for login/register/otp flows;
      // this fallback is used only by refreshSession() which doesn't expose it.
      let jwtToken: string | null = null;
      let sessionGuuid = '';

      // Validate device type against schema enum
      type DeviceType = 'IOS' | 'ANDROID' | 'WEB';
      const VALID_DEVICE_TYPES: readonly DeviceType[] = [
        'IOS',
        'ANDROID',
        'WEB',
      ];
      const rawDeviceType = deviceInfo?.deviceType?.toUpperCase() as
        | DeviceType
        | undefined;
      const validatedDeviceType: DeviceType | null =
        rawDeviceType && VALID_DEVICE_TYPES.includes(rawDeviceType)
          ? rawDeviceType
          : null;

      // Compute IP hash (HMAC-SHA256 — privacy-safe fingerprint, server-keyed)
      const ipHash = deviceInfo?.ipAddress
        ? crypto
            .createHmac('sha256', IP_HMAC_SECRET)
            .update(deviceInfo.ipAddress)
            .digest('hex')
        : null;

      // Update session with full device fingerprint + role hash, capture guuid
      const updatedSession = await this.sessionsRepository.updateByToken(
        session.token,
        {
          roleHash,
          ...(deviceInfo
            ? {
                deviceId: deviceInfo.deviceId || null,
                deviceName: deviceInfo.deviceName || null,
                deviceType: validatedDeviceType,
                appVersion: deviceInfo.appVersion || null,
                ipAddress: deviceInfo.ipAddress || null,
                userAgent: deviceInfo.userAgent || null,
                ipHash,
              }
            : {}),
        },
      );

      sessionGuuid = updatedSession?.guuid ?? '';

      // Sign JWT now that session guuid is available for sid claim
      try {
        jwtToken = this.jwtConfigService.signToken({
          sub: user?.guuid || '',
          sid: sessionGuuid,
          jti: crypto.randomUUID(),
          email: user?.email || 'noemail@example.com',
          roles: userRoles.map((r) => r.roleCode),
          primaryRole,
          stores: userRoles
            .filter((r) => r.storeId && r.storeName)
            .map((r) => ({
              id: r.storeId as number,
              name: r.storeName as string,
            })),
          activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
          iss: process.env.BETTER_AUTH_BASE_URL || 'nks-auth',
          aud: JWT_AUDIENCE,
        });
      } catch (jwtErr) {
        this.logger.error(`Failed to generate RS256 JWT: ${jwtErr}`);
      }

      this.logger.log(
        `Session created for user ${userId}. RS256 JWT token generated with embedded roles.`,
      );

      // Delete oldest sessions if > 10
      await this.enforceSessionLimit(userId);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid,
        jwtToken: jwtToken || undefined,
        userRoles,
        userEmail: user?.email || 'noemail@example.com',
      };
    } catch (err) {
      this.logger.error(`Failed to add roles/JWT to session: ${err}`);
      // Don't fail session creation, return just the session token
      return {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid: '',
        userRoles: [],
        userEmail: 'noemail@example.com',
      };
    }
  }

  /**
   * Login a user with email + password.
   * BetterAuth creates the session after credentials are verified.
   *
  
   */
  /**
   * Authenticate user with email and password.
   * Validates credentials, enforces brute-force protection, and creates a new session.
   *
   * @param dto - Login credentials (email and password matching registration requirements)
   * @param deviceInfo - Optional device context:
   *   - `deviceId` — Unique device identifier for this platform
   *   - `deviceName` — Human-readable device name
   *   - `deviceType` — One of: IOS, ANDROID, WEB
   *   - `appVersion` — Application version for analytics
   * @returns AuthResponseEnvelope with user data, roles, and session tokens
   * @throws UnauthorizedException if credentials are invalid, account is blocked, or locked due to brute-force
   */
  async login(
    dto: LoginDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    const auditDeviceInfo = {
      deviceId: deviceInfo?.deviceId,
      deviceType: deviceInfo?.deviceType,
    };

    // Use repository to find user by email
    const user = await this.authUsersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) {
      void this.auditService.log({
        eventType: AuditEventType.LOGIN,
        userId: user.id,
        description: 'Login attempt - account is blocked',
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        metadata: auditDeviceInfo,
        severity: 'warning',
        resourceType: 'user',
        resourceId: user.id,
      });
      throw new UnauthorizedException('Account is blocked');
    }

    // Check brute-force lockout (with auto-unlock if expired)
    if (user.accountLockedUntil) {
      const now = new Date();
      if (user.accountLockedUntil > now) {
        void this.auditService.log({
          eventType: AuditEventType.LOGIN,
          userId: user.id,
          description: 'Login attempt - account locked (brute-force)',
          ipAddress: deviceInfo?.ipAddress,
          userAgent: deviceInfo?.userAgent,
          metadata: auditDeviceInfo,
          severity: 'warning',
          resourceType: 'user',
          resourceId: user.id,
        });
        throw new UnauthorizedException(
          `Account locked due to too many failed attempts. Try again after ${user.accountLockedUntil.toISOString()}`,
        );
      } else {
        // Lock has expired, auto-unlock account via repository
        const unlocked = await this.authUsersRepository.update(user.id, {
          accountLockedUntil: null,
          failedLoginAttempts: 0,
        });
        if (!unlocked) {
          throw new Error(`Failed to update user lockout status for user ${user.id}`);
        }
        this.logger.log(
          `Auto-unlocked account for user ${user.id} (lockout expired)`,
        );
      }
    }

    const provider = await this.authProviderRepository.findByUserIdAndProvider(
      user.id,
      'email',
    );

    if (!provider?.password) {
      // SECURITY: Use generic error message to prevent user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordService.compare(
      dto.password,
      provider.password,
    );
    if (!isValid) {
      const newFailedCount = user.failedLoginAttempts + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;
      // Update failed attempts (and lock if threshold exceeded) via repository
      const updated = await this.authUsersRepository.update(user.id, {
        failedLoginAttempts: newFailedCount,
        ...(shouldLock
          ? {
              accountLockedUntil: new Date(
                Date.now() + LOCKOUT_MINUTES * 60 * 1000,
              ),
            }
          : {}),
      });
      if (!updated) {
        throw new Error(`Failed to update failed login attempts for user ${user.id}`);
      }
      void this.auditService.log({
        eventType: AuditEventType.LOGIN,
        userId: user.id,
        description: 'Login attempt - invalid password',
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        metadata: {
          ...auditDeviceInfo,
          failedAttempts: newFailedCount,
          accountLocked: shouldLock,
        },
        severity: 'warning',
        resourceType: 'user',
        resourceId: user.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset lockout state and record login via repository
    const loginReset = await this.authUsersRepository.update(user.id, {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastActiveAt: new Date(),
    });
    if (!loginReset) {
      throw new Error(`Failed to reset lockout state for user ${user.id}`);
    }
    await this.authUsersRepository.recordLogin(user.id);

    // Use token pair (access + refresh)
    const session = await this.createSessionForUser(user.id, deviceInfo);
    const tokenPair = await this.createTokenPair(
      user.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    void this.auditService.log({
      eventType: AuditEventType.LOGIN,
      userId: user.id,
      description: 'User logged in via email',
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: { ...auditDeviceInfo },
      severity: 'info',
      resourceType: 'user',
      resourceId: user.id,
    });

    return this.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }

  /**
   * Register a new user with email + password.
   * First registered user is automatically assigned SUPER_ADMIN role.
   *
  
   */
  /**
   * Register a new user account.
   * Creates user with email/password, validates all inputs, and returns authenticated session.
   * Password must meet strict requirements: min 12 chars, uppercase, lowercase, number, special char.
   *
   * @param dto - Registration data (email, password, name)
   * @param deviceInfo - Optional device context (same as login)
   * @returns AuthResponseEnvelope with new user data and session tokens
   * @throws ConflictException if email already registered
   * @throws BadRequestException if password doesn't meet requirements
   */
  async register(
    dto: RegisterDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    // Sanitize inputs
    dto.email = SanitizerValidator.sanitizeEmail(dto.email);
    dto.name = SanitizerValidator.sanitizeName(dto.name);

    // Validate email format
    EmailValidator.validate(dto.email);

    // Validate password strength
    PasswordValidator.validateStrength(dto.password);

    // Check if email already exists via repository
    const existingUser = await this.authUsersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Generate IAM user ID
    const iamUserId = crypto.randomUUID();

    // Delegate entire registration (user + auth provider + role assignment) to repository
    // SECURITY: This wraps the entire operation in a single atomic transaction,
    // preventing race conditions where multiple users could become SUPER_ADMIN.
    const user = await this.authUsersRepository.createUserWithInitialRole(
      {
        iamUserId,
        name: dto.name,
        email: dto.email,
        emailVerified: false,
      },
      {
        providerId: 'email',
        accountId: dto.email,
        password: passwordHash,
        isVerified: false,
      },
      // Callback for role assignment (receives transaction context + userId)
      async (tx, userId) => {
        await this.assignInitialRoleInTransaction(userId, tx);
      },
    );

    if (!user) {
      throw new ConflictException('Email already in use');
    }

    // Use token pair (access + refresh)
    const session = await this.createSessionForUser(user.id, deviceInfo);
    const tokenPair = await this.createTokenPair(
      user.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    return this.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }

  /**
   * Check whether any SUPER_ADMIN account exists yet.
   * Queries roles table for the SUPER_ADMIN system role, then checks user_role_mapping.
   */
  async isSuperAdminSeeded(): Promise<boolean> {
    const superAdminRoleId =
      await this.rolesRepository.findSystemRoleId('SUPER_ADMIN');
    if (!superAdminRoleId) return false;
    return this.rolesRepository.hasUserWithRole(superAdminRoleId);
  }

  /**
   * Auto-assign SUPER_ADMIN role to first user in the system.
   * Called after user creation via BetterAuth hook.
   * SECURITY: This is called automatically by BetterAuth after user creation.
   * Business logic extracted from config layer to service layer for testability and auditability.
   *
   * @param userId - ID of the newly created user
   * @throws Error if user already exists or role assignment fails
   */
  async assignFirstUserAsSuperAdminIfNeeded(userId: number): Promise<void> {
    try {
      // Check if any SUPER_ADMIN already exists
      const superAdminExists = await this.isSuperAdminSeeded();
      if (superAdminExists) {
        return; // SUPER_ADMIN already exists, skip assignment
      }

      // Get SUPER_ADMIN role ID
      const superAdminRoleId =
        await this.rolesRepository.findSystemRoleId('SUPER_ADMIN');
      if (!superAdminRoleId) {
        this.logger.warn(
          'SUPER_ADMIN role not found in database. Ensure system roles are seeded.',
        );
        return;
      }

      // Assign SUPER_ADMIN role to first user
      await this.db.insert(schema.userRoleMapping).values({
        userFk: userId,
        roleFk: superAdminRoleId,
        isPrimary: true,
        isActive: true,
        assignedAt: new Date(),
      });

      this.logger.log(
        `First user (ID: ${userId}) auto-assigned SUPER_ADMIN role`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to assign SUPER_ADMIN role to first user`,
        err instanceof Error ? err.stack : String(err),
      );
      // Don't rethrow - this is a non-critical operation that shouldn't fail user creation
    }
  }

  /**
   * Refresh session with token rotation.
   * Validates the current session token via BetterAuth and issues a new opaque token.
   * Protects against token theft by immediately invalidating old tokens.
   *
   * @param oldToken - Current session token to refresh (from Authorization header)
   * @returns New session token with updated expiry
   * @throws UnauthorizedException if token is invalid, expired, or user permissions have changed
   *
   * Implementation notes:
   * - Token hashing is handled by BetterAuth's getSession method
   * - Creates new session with SELECT FOR UPDATE locking to prevent race conditions
   * - If user roles changed, invalidates ALL user sessions to force re-login
   * - Old token is immediately deleted to prevent reuse attacks
   */
  async refreshSession(
    oldToken: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    // Validate token via BetterAuth (BetterAuth handles token hashing internally)
    const session = await this.auth.api.getSession({
      headers: { authorization: `Bearer ${oldToken}` },
    });

    if (!session || !session.user)
      throw new UnauthorizedException('Invalid or expired session token');

    // Check if session is expired
    if (new Date(session.session.expiresAt) < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    const userId = Number(session.user.id);

    // Detect if roles have changed
    // roleHash is not in BetterAuth's public type but may be stored as extra session data
    const storedRoleHash = (session.session as Record<string, unknown>)
      ?.roleHash as string | undefined;
    if (storedRoleHash) {
      const currentPermissions = await this.getUserPermissions(userId);
      const currentRoleHash = this.hashRoles(currentPermissions.roles || []);

      if (storedRoleHash !== currentRoleHash) {
        this.logger.warn(
          `Role change detected for user ${userId}, invalidating all sessions`,
        );
        // Roles changed! Invalidate all sessions to force re-login
        await this.invalidateUserSessions(userId);
        throw new UnauthorizedException(
          'Your roles have been updated. Please re-login.',
        );
      }
    }

    // Create a new session for the same user
    return this.createSessionForUser(userId);
  }

  /**
   * Increment loginCount, set lastLoginAt and lastActiveAt on successful login.
   * Called from OTP and OAuth paths that don't go through login().
   */
  async recordSuccessfulLogin(userId: number): Promise<void> {
    await this.authUsersRepository.recordSuccessfulLogin(userId);
  }

  /**
   * Invalidate the current session token.
   * Immediately revokes session, clearing httpOnly cookie on client.
   *
   * @param token - Session token to invalidate (already validated by guard)
   * @returns void (no error if token already expired)
   *
   * Implementation:
   * - Token is already validated by AuthGuard before this is called
   * - Session is deleted synchronously to prevent race conditions
   * - Client must clear httpOnly cookie (done by controller)
   */
  async logout(token: string): Promise<void> {
    // Delegate to SessionService to invalidate session by token
    // AuthGuard already validated this token
    await this.sessionService.invalidateSessionByToken(token);
  }

  /** Assign CUSTOMER role to a user (personal account setup). */

  /**
   * Invalidate all sessions for a user.
   * Force immediate logout by deleting all sessions
   */
  async invalidateUserSessions(
    userId: number,
    reason = 'ROLE_CHANGE',
  ): Promise<void> {
    const count = await this.sessionService.terminateAllSessions(userId);
    this.logger.log(
      `Invalidated ${count} session(s) for user ${userId}: ${reason}`,
    );
  }

  /**
   * Fetch all roles, permissions, activeStoreId, and userType for a user.
   * ALWAYS fetches fresh from DB to ensure role changes are immediately reflected.
   * (Do not rely on stale role cache in userSession table)
   */
  async getUserPermissions(
    userId: number,
  ): Promise<PermissionContext & { permissionCodes: string[] }> {
    // RoleRow is the union of what both repository methods return
    type RoleRow = Awaited<
      ReturnType<typeof this.rolesRepository.findUserRolesWithCompany>
    >[number];

    let userRoles: RoleRow[] = [];
    try {
      userRoles = await this.rolesRepository.findUserRolesWithCompany(userId);
    } catch (error) {
      // Log the actual error before falling back so it is visible in monitoring
      this.logger.error(
        `getUserPermissions: findUserRolesWithCompany failed for user ${userId}, falling back to basic query`,
        error instanceof Error ? error.stack : String(error),
      );
      // Fall back to simpler query that omits store join
      const basicRoles = await this.rolesRepository.findUserRoles(userId);
      // Map basic roles to include storeName field (null) for type compatibility
      userRoles = basicRoles.map((role) => ({
        ...role,
        storeName: null,
      }));
    }

    const roleCodes = userRoles.map((r) => r.roleCode);
    const activeStoreId =
      userRoles.find((r) => r.storeFk != null)?.storeFk ?? null;

    // Generate assignedAt timestamp before passing to mapper
    const assignedAt = new Date().toISOString();
    const roles = AuthMapper.mapToRoleEntries(userRoles, undefined, assignedAt);

    // Return fresh permissions from DB (not from cached session)
    if (roleCodes.includes('SUPER_ADMIN')) {
      return {
        roles,
        isSuperAdmin: true,
        activeStoreId,
        permissionCodes: this.extractPermissionCodes(userRoles),
      };
    }

    return {
      roles,
      isSuperAdmin: false,
      activeStoreId,
      permissionCodes: this.extractPermissionCodes(userRoles),
    };
  }

  /**
   * Extract permission codes from user roles.
   * Used to verify user has required permissions for protected endpoints.
   */
  private extractPermissionCodes(
    userRoles: Array<{
      roleCode?: string;
      code?: string;
      permissions?: unknown;
    }>,
  ): string[] {
    const permissionCodes = new Set<string>();

    userRoles.forEach((role) => {
      // Add role code as permission
      const roleCode = role.roleCode || role.code;
      if (roleCode) {
        permissionCodes.add(roleCode);
      }
      // Add individual permissions if available (future-proof for enriched role rows)
      if (role.permissions && Array.isArray(role.permissions)) {
        (role.permissions as Array<string | { code?: string }>).forEach(
          (perm) => {
            if (typeof perm === 'string') {
              permissionCodes.add(perm);
            } else if (typeof perm === 'object' && perm.code) {
              permissionCodes.add(perm.code);
            }
          },
        );
      }
    });

    return Array.from(permissionCodes);
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
    const user = await this.authUsersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    let emailVerificationSent = false;
    let phoneVerificationSent = false;
    let nextStep: 'verifyEmail' | 'verifyPhone' | 'complete' = 'complete';

    // Wrap all profile updates in a transaction
    await this.db.transaction(async () => {
      // Update name via repository
      const nameUpdated = await this.authUsersRepository.update(userId, { name: dto.name });
      if (!nameUpdated) {
        throw new Error(`Failed to update user name for user ${userId}`);
      }

      // Case 1: User logged in via phone, adding email + password
      if (dto.email) {
        if (!dto.password) {
          throw new BadRequestException(
            'Password is required when adding email',
          );
        }

        // SECURITY: Check email not already in use by OTHER users
        const emailTaken =
          await this.authUsersRepository.emailExistsForOtherUser(
            dto.email,
            userId,
          );

        if (emailTaken) {
          throw new ConflictException('Email already in use by another user');
        }

        // Update user email (unverified initially) via repository
        const emailUpdated = await this.authUsersRepository.update(userId, {
          email: dto.email,
          emailVerified: false,
        });
        if (!emailUpdated) {
          throw new Error(`Failed to update user email for user ${userId}`);
        }

        // Hash and store password
        const hash = await this.passwordService.hash(dto.password);
        const existingProviderId =
          await this.authProviderRepository.findIdByUserIdAndProvider(
            userId,
            'email',
          );

        if (existingProviderId) {
          await this.authProviderRepository.updatePassword(
            existingProviderId,
            hash,
          );
        } else {
          await this.authProviderRepository.create({
            accountId: dto.email,
            providerId: 'email',
            userId,
            password: hash,
            isVerified: false,
          });
        }

        nextStep = 'verifyEmail';
      }

      // Case 2: User logged in via email, adding phone number
      if (dto.phoneNumber) {
        // Check phone not already linked to this user
        const alreadyLinked = await this.authUsersRepository.phoneLinkedToUser(
          dto.phoneNumber,
          userId,
        );

        if (!alreadyLinked) {
          // Update user phone (unverified initially) via repository
          const phoneUpdated = await this.authUsersRepository.update(userId, {
            phoneNumber: dto.phoneNumber,
            phoneNumberVerified: false,
          });
          if (!phoneUpdated) {
            throw new Error(`Failed to update user phone for user ${userId}`);
          }
        }

        nextStep = 'verifyPhone';
      }

      // If nothing added, mark profile as complete via repository
      if (!dto.email && !dto.phoneNumber) {
        await this.authUsersRepository.markProfileComplete(userId);
      }
    });

    // Send OTPs outside transaction (can fail without rolling back DB changes)
    if (dto.email) {
      await this.otpService.sendEmailOtp(dto.email);
      emailVerificationSent = true;
    }

    if (dto.phoneNumber) {
      await this.otpService.sendOtp({ phone: dto.phoneNumber });
      phoneVerificationSent = true;
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
    // Terminate all old sessions for this user
    await this.sessionService.terminateAllSessions(userId);

    // Issue new session via BetterAuth
    return this.createSessionForUser(userId);
  }

  /**
   * Clean up expired sessions from the database.
   * Run this as a scheduled task (cron) every hour or daily
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      return await this.sessionService.cleanupExpiredSessions();
    } catch (err) {
      this.logger.error(`Failed to cleanup expired sessions: ${err}`);
      throw err;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
  
   * Used for detecting role changes between refresh cycles
   */
  private hashRoles(roles: UserRoleEntry[]): string {
    try {
      const roleString = JSON.stringify(
        roles.map((r) => `${r.roleCode}:${r.storeId}`),
      );
      return crypto.createHash('sha256').update(roleString).digest('hex');
    } catch (err) {
      this.logger.error(`Failed to hash roles: ${err}`);
      return '';
    }
  }

  /**
   * Assign the correct initial role to a newly registered user — one row, no soft-delete.
   * Called INSIDE the user creation transaction to prevent race condition on first user.
   * Uses FOR UPDATE lock to ensure only one user can be assigned SUPER_ADMIN.
   *
   * - First user ever → SUPER_ADMIN (platform administrator)
   * - All subsequent users → USER (default platform user)
   *
   * @param userId - The newly created user ID
   * @param tx - The transaction client to use (required for atomic operation)
   */
  private async assignInitialRoleInTransaction(
    userId: number,
    tx: NodePgDatabase<typeof schema>,
  ): Promise<void> {
    try {
      const superAdminRoleId = await this.rolesRepository.findSystemRoleId(
        'SUPER_ADMIN',
        tx,
      );
      if (!superAdminRoleId) {
        this.logger.warn(
          `assignInitialRoleInTransaction: SUPER_ADMIN system role not found in DB`,
        );
        return;
      }

      const roleCode =
        await this.rolesRepository.resolveInitialRoleWithinTransaction(
          tx,
          superAdminRoleId,
        );

      await this.rolesRepository.assignRoleWithinTransaction(
        tx,
        userId,
        roleCode,
      );
    } catch (err) {
      this.logger.error(
        `assignInitialRoleInTransaction failed for userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  /**
   * Fetch permissions, generate trace IDs, and build the unified AuthResponseDto.
   * Shared by login(), register(), and OTP verifyOtp().
   *
  
   */
  async buildAuthResponse(
    user: {
      id: number;
      guuid?: string | null;
      email: string | null;
      name: string;
      emailVerified: boolean;
      image: string | null | undefined;
      phoneNumber: string | null | undefined;
      phoneNumberVerified: boolean;
    },
    token: string,
    expiresAt: Date,
    tokenPair?: TokenPair,
  ): Promise<AuthResponseEnvelope> {
    const requestId = crypto.randomUUID();
    const traceId = crypto.randomUUID();

    // Generate timestamps and IDs at service layer (business logic, not transformation)
    const sessionId = crypto.randomUUID();
    const issuedAt = new Date().toISOString();

    // Calculate refresh token expiry: 30 days from now
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // JWT expiry: use tokenPair if provided, otherwise use session expiry
    const jwtExpiresAt = tokenPair?.jwtExpiresAt ?? expiresAt;

    // Fetch user's primary/default store.
    // Primary store: where user is STORE_OWNER (exactly one per user via unique constraint).
    const storeOwnerRoleId = await this.rolesRepository.findSystemRoleId(
      SYSTEM_ROLE_STORE_OWNER,
    );
    const primaryStore = storeOwnerRoleId
      ? await this.rolesRepository.findPrimaryStoreForUser(
          user.id,
          storeOwnerRoleId,
        )
      : null;

    return AuthMapper.toAuthResponseEnvelope(
      {
        user: {
          id: user.id,
          guuid: user.guuid ?? '',
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image ?? null,
          phoneNumber: user.phoneNumber ?? null,
          phoneNumberVerified: user.phoneNumberVerified,
          lastLoginAt: new Date(),
          lastLoginIp: null,
        },
        token,
        session: {
          token,
          expiresAt,
          sessionId, // Already generated above
        },
      },
      await this.getUserPermissions(user.id),
      requestId,
      traceId,
      tokenPair,
      primaryStore ? { guuid: primaryStore.guuid } : null,
      sessionId, // Pass pre-generated sessionId
      issuedAt, // Pass pre-generated timestamp
      jwtExpiresAt, // Pass JWT expiry
      refreshExpiresAt, // Pass refresh token expiry
    );
  }

  /**
  
   * Works for WEB and MOBILE
   *
   * Access Token: JWT, 1 hour expiry
   * Refresh Token: Opaque, 30 days expiry (stored as hash)
   */
  async createTokenPair(
    userGuuid: string,
    sessionToken: string,
    userRoles: SessionUserRole[],
    userEmail: string,
    sessionGuuid: string,
  ): Promise<TokenPair> {
    // Sign RS256 JWT — for mobile offline role decoding only
    // Roles and email are passed in — no extra DB queries needed
    const jwtToken = this.jwtConfigService.signToken({
      sub: userGuuid,
      sid: sessionGuuid,
      jti: crypto.randomUUID(),
      email: userEmail,
      roles: userRoles.map((r) => r.roleCode),
      primaryRole: userRoles[0]?.roleCode || null,
      stores: userRoles
        .filter((r) => r.storeId && r.storeName)
        .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
      activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
      iss: process.env.BETTER_AUTH_BASE_URL || 'nks-auth',
      aud: 'nks-app',
    });

    // Structured refresh token: base64url(sessionGuuid:randomSecret)
    // sessionGuuid prefix enables direct session lookup (no hash scan on refresh)
    // Only HMAC(randomSecret) is stored — the public sessionGuuid is not hashed
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const refreshToken = Buffer.from(
      `${sessionGuuid}:${randomSecret}`,
    ).toString('base64url');
    const refreshTokenHash = crypto
      .createHmac('sha256', REFRESH_TOKEN_HMAC_SECRET)
      .update(randomSecret)
      .digest('hex');

    // Calculate expiry times
    const now = new Date();
    const jwtExpiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1h
    const refreshTokenExpiresAt = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    ); // 7d (rolling window — resets on each refresh)

    // Store hash in the specific session only — not all user sessions
    await this.sessionsRepository.setRefreshTokenData(sessionToken, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      accessTokenExpiresAt: jwtExpiresAt,
    });

    this.logger.log(
      `Token pair created for user ${userGuuid}. JWT expires in 1h, refresh token in 30d.`,
    );

    // Return both tokens to client
    return {
      jwtToken,
      refreshToken,
      jwtExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
  
   * Works for WEB and MOBILE
   *
   * Validates refresh token hasn't expired, generates new access token
   */
  async refreshAccessToken(
    refreshToken: string,
    deviceId: string | null = null,
  ): Promise<{
    sessionId: string;
    sessionToken: string;
    jwtToken: string;
    expiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    defaultStore: { guuid: string } | null;
  }> {
    // Step 1: Decode structured refresh token — base64url(sessionGuuid:randomSecret)
    // Extract sessionGuuid for direct PK-adjacent lookup (no hash scan)
    let sessionGuuidFromToken: string;
    let randomSecretFromToken: string;
    try {
      const decoded = Buffer.from(refreshToken, 'base64url').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) throw new Error('malformed');
      sessionGuuidFromToken = decoded.substring(0, colonIdx);
      randomSecretFromToken = decoded.substring(colonIdx + 1);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Step 2: Look up session by guuid WITH EXCLUSIVE LOCK (direct unique-index lookup)
    // FOR UPDATE prevents two concurrent requests from both rotating the same token
    const session = await this.sessionsRepository.findByGuuidForUpdate(
      sessionGuuidFromToken,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Step 2a: Verify HMAC(randomSecret) — ensures token wasn't forged
    const expectedHash = crypto
      .createHmac('sha256', REFRESH_TOKEN_HMAC_SECRET)
      .update(randomSecretFromToken)
      .digest('hex');
    const isValidSecret =
      session.refreshTokenHash != null &&
      crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(session.refreshTokenHash, 'hex'),
      );
    if (!isValidSecret) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Step 2b: THEFT DETECTION — Check if token was already used
    // If refreshTokenRevokedAt is set, it means this token was already rotated
    // (legitimate case) or already used by attacker (theft case)
    // Either way, this token is no longer valid
    if (session.refreshTokenRevokedAt !== null) {
      // CRITICAL: Token reuse detected! This refresh token was already used.
      // This could mean:
      // 1. Legitimate user: Token was already rotated, they're using old token (shouldn't happen)
      // 2. Attacker: Stolen token, trying to use after legitimate user already rotated
      // Either way, this session is compromised.

      this.logger.error(
        `TOKEN THEFT DETECTED: User ${session.userId} attempted to reuse rotated refresh token. Session ${session.id} is compromised.`,
        {
          sessionId: session.id,
          revokedAt: session.refreshTokenRevokedAt,
          attemptedAt: new Date(),
        },
      );

      // Mark all sessions TOKEN_REUSE then hard-delete (emergency security response)
      await this.sessionsRepository.revokeAndDeleteAllForUser(
        session.userId,
        'TOKEN_REUSE',
      );

      throw new UnauthorizedException(
        'Session compromised. Please log in again.',
      );
    }

    // Step 3: Validate session hasn't already expired
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    // Step 3a: Validate device binding — prevents refresh token from being used on different device
    // SCENARIO 1 (Web): Both null → passes (web uses cookies, not device binding)
    // SCENARIO 2 (Mobile, same device): Both "uuid123" → passes
    // SCENARIO 3 (Mobile, different device): session="uuid123", request="uuid456" → REJECTED
    // Note: If user legitimately switches devices, they must re-authenticate via OTP
    if (session.deviceId !== null && session.deviceId !== deviceId) {
      throw new UnauthorizedException('Refresh token device mismatch');
    }

    // Step 3b: Validate refresh token hasn't expired
    if (
      session.refreshTokenExpiresAt &&
      session.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Step 4: Get current permissions and generate new access token
    const permissions = await this.getUserPermissions(session.userId);
    const userRoles = permissions.roles || [];
    const currentRoleHash = this.hashRoles(userRoles);

    const user = await this.authUsersRepository.findEmailAndGuuid(
      session.userId,
    );

    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    // Step 5: Rotate session token — create new BetterAuth session (new opaque token)
    const ctx = await this.getBetterAuthContext();
    const createdSession = await ctx.internalAdapter.createSession(
      String(session.userId),
    );
    if (!createdSession)
      throw new UnauthorizedException('Failed to rotate session');

    // Fetch the new session from DB to get fully-typed row (id, guuid, token, etc.)
    const newSession = await this.sessionsRepository.findByTokenFull(
      createdSession.token,
    );

    if (!newSession)
      throw new UnauthorizedException('Failed to retrieve rotated session');

    // Step 6: Generate new structured refresh token using new session guuid
    // base64url(newSession.guuid:randomSecret) — enables direct lookup on next refresh
    const newRandomSecret = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = Buffer.from(
      `${newSession.guuid}:${newRandomSecret}`,
    ).toString('base64url');
    const newRefreshTokenHash = crypto
      .createHmac('sha256', REFRESH_TOKEN_HMAC_SECRET)
      .update(newRandomSecret)
      .digest('hex');
    const newRefreshTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ); // 7d rolling window

    // Sign new JWT now that newSession.guuid is available for sid
    const accessToken = this.jwtConfigService.signToken({
      sub: user?.guuid || '',
      sid: newSession.guuid,
      jti: crypto.randomUUID(),
      email: user?.email || '',
      roles: userRoles.map((r) => r.roleCode),
      primaryRole: userRoles[0]?.roleCode || null,
      stores: userRoles
        .filter((r) => r.storeId && r.storeName)
        .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
      activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
      iss: process.env.BETTER_AUTH_BASE_URL || 'nks-auth',
      aud: 'nks-app',
    });

    // Copy device context and update role hash into the new session row
    // Roles are always read live from user_role_mapping — never cached in session
    await this.sessionsRepository.update(newSession.id, {
      roleHash: currentRoleHash,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      appVersion: session.appVersion,
      activeStoreFk: session.activeStoreFk,
      refreshTokenHash: newRefreshTokenHash,
      refreshTokenExpiresAt: newRefreshTokenExpiresAt,
      accessTokenExpiresAt,
    });

    // Mark OLD token as revoked (for theft detection on next use)
    await this.sessionsRepository.update(session.id, {
      refreshTokenRevokedAt: new Date(),
      revokedReason: 'ROTATION',
    });

    // Step 7: Fetch default store
    const storeOwnerRoleId = await this.rolesRepository.findSystemRoleId(
      SYSTEM_ROLE_STORE_OWNER,
    );
    const primaryStore = storeOwnerRoleId
      ? await this.rolesRepository.findPrimaryStoreForUser(
          session.userId,
          storeOwnerRoleId,
        )
      : null;

    this.logger.log(`Session rotated for user ${session.userId}`);

    return {
      sessionId: newSession.guuid,
      // New BetterAuth opaque token — update cookie (web) and secure storage (mobile)
      sessionToken: newSession.token,
      // New RS256 JWT — mobile updates local store for offline role decoding
      jwtToken: accessToken,
      expiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken: newRefreshToken,
      refreshExpiresAt: newRefreshTokenExpiresAt.toISOString(),
      defaultStore: primaryStore ? { guuid: primaryStore.guuid } : null,
    };
  }

  /**
  
   * Detects if roles have changed since JWT was issued
   * Returns updated permissions if roles changed
   */
  async verifyClaims(jwtToken: string): Promise<VerifyClaimsResponse> {
    try {
      // Verify JWT signature and validate audience
      const payload = this.jwtConfigService.verifyToken(jwtToken);

      // Validate audience claim
      if (payload.aud !== JWT_AUDIENCE) {
        throw new UnauthorizedException('Invalid JWT audience');
      }

      // Resolve user ID from GUUID (sub claim is now the immutable GUUID)
      const user = await this.authUsersRepository.findByGuuid(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get current user roles
      const currentPermissions = await this.getUserPermissions(user.id);
      const currentRoles = currentPermissions.roles || [];
      const currentRoleCodes = currentRoles.map((r) => r.roleCode);

      // Check if roles changed
      const tokenRoles = payload.roles || [];
      const rolesChanged = !this.arraysEqual(
        currentRoleCodes.sort(),
        tokenRoles.sort(),
      );

      this.logger.log(
        `JWT claims verified for user ${payload.sub}. Roles changed: ${rolesChanged}`,
      );

      return {
        isValid: true,
        sub: payload.sub,
        rolesChanged,
        currentRoles: currentRoleCodes,
        stores: currentRoles
          .filter((r) => r.storeId)
          .map((r) => ({ id: r.storeId, name: r.storeName })),
      };
    } catch (error) {
      this.logger.error(`JWT verification failed: ${error}`);
      return {
        isValid: false,
        rolesChanged: false,
      };
    }
  }

  /**
   * Enforce session limit: max 5 concurrent sessions per user.
   * If limit exceeded, delete oldest session(s).
   * Called after new session creation.
   */
  private async enforceSessionLimit(userId: number): Promise<void> {
    const MAX_CONCURRENT_SESSIONS = 5;

    const sessions =
      await this.sessionsRepository.findAllByUserIdOrdered(userId);

    const excessCount = sessions.length - MAX_CONCURRENT_SESSIONS;
    if (excessCount > 0) {
      const sessionsToDelete = sessions.slice(0, excessCount);
      for (const session of sessionsToDelete) {
        await this.sessionsRepository.delete(session.id);
      }
      this.logger.log(
        `Enforced session limit for user ${userId}. Deleted ${excessCount} oldest session(s).`,
      );
    }
  }

  // ─── Phase 2: Offline-First & Permissions ──────────────────────────────────

  /**
   * Get permissions snapshot for a user (for JWT claims)
   */
  async getPermissionsSnapshot(userId: number): Promise<PermissionsSnapshot> {
    return this.permissionsService.buildPermissionsSnapshot(userId);
  }

  /**
   * Get permissions version for a user
   */
  async getPermissionsVersion(userId: number): Promise<string> {
    return this.permissionsService.getPermissionsVersion(userId);
  }

  /**
   * Calculate permissions delta since version
   */
  async calculatePermissionsDelta(
    userId: number,
    sinceVersion: string,
  ): Promise<{
    version: string;
    sinceVersion: string;
    added: PermissionsSnapshot;
    removed: PermissionsSnapshot;
    modified: PermissionsSnapshot;
  }> {
    const delta = await this.permissionsService.calculateDelta(
      userId,
      sinceVersion,
    );
    return {
      version: delta.version,
      sinceVersion: sinceVersion,
      added: delta.added,
      removed: delta.removed,
      modified: delta.modified,
    };
  }

  // ─── Phase 3: Device & Session Management ──────────────────────────────────

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions =
      await this.sessionsRepository.findActiveSessionsForUser(userId);

    return sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt?.toISOString() ?? new Date(0).toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(
    userId: number,
    sessionId: string,
    requestingUserId?: number,
    isSuperAdmin: boolean = false,
  ): Promise<void> {
    // SECURITY: Authorization check - users can only terminate their own sessions unless SUPER_ADMIN
    if (requestingUserId && userId !== requestingUserId && !isSuperAdmin) {
      throw new ForbiddenException('You can only terminate your own sessions');
    }

    const sessionIdNum = parseInt(sessionId, 10);

    // Verify session belongs to user
    const session = await this.sessionsRepository.findByIdAndUserId(
      sessionIdNum,
      userId,
    );

    if (!session) {
      throw new Error('Session not found or does not belong to user');
    }

    await this.sessionsRepository.delete(sessionIdNum);
    this.logger.log(`Session ${sessionId} terminated for user ${userId}`);
  }

  /**
   * Terminate all sessions for a user (e.g., after password change)
   */
  async terminateAllSessions(userId: number): Promise<void> {
    await this.sessionsRepository.deleteAllForUser(userId);
    this.logger.log(`All sessions terminated for user ${userId}`);
  }

  // ─── Private Helpers (continued) ────────────────────────────────────────────

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
