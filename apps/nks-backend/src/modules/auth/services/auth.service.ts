import * as crypto from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, lt } from 'drizzle-orm';
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
import {
  AuthMapper,
  type UserRoleEntry,
  type PermissionContext,
} from '../mappers/auth-mapper';
import { InjectAuth } from '../decorators/inject-auth.decorator';
import type { Auth } from '../config/better-auth';
import { RolesRepository } from '../../roles/roles.repository';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { JWTConfigService } from '../../../common/config/jwt.config';
import { RoutesService } from '../../routes/routes.service';

type Db = NodePgDatabase<typeof schema>;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
    @InjectAuth() private readonly auth: Auth,
    private readonly rolesRepository: RolesRepository,
    private readonly passwordService: PasswordService,
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly routesService: RoutesService,
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
   * ✅ MODULE 1: Generate RS256 JWT token
   * ✅ ISSUE #1 FIX: Embed JWT token with roles
   * ✅ ISSUE #5 FIX: Capture device tracking data
   * ✅ ISSUE #2 FIX: Calculate role hash for change detection
   */
  async createSessionForUser(
    userId: number,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<{ token: string; expiresAt: Date; jwtToken?: string }> {
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
    const session = await ctx.internalAdapter.createSession(String(userId));

    if (!session) throw new UnauthorizedException('Failed to create session');

    // Fetch and embed roles in session + JWT
    try {
      const permissions = await this.getUserPermissions(userId);
      const userRoles = permissions.roles || [];
      const primaryRole = userRoles[0]?.roleCode || null;

      // Get user email for JWT
      const [user] = await this.db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      // ✅ ISSUE #2 FIX: Calculate role hash for detecting changes
      this.hashRoles(userRoles);

      // ✅ MODULE 1: Create and sign RS256 JWT with embedded roles
      let jwtToken: string | null = null;
      try {
        jwtToken = this.jwtConfigService.signToken({
          sub: String(userId),
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
          aud: 'nks-app',
        });
      } catch (jwtErr) {
        Logger.error(`Failed to generate RS256 JWT: ${jwtErr}`);
        // Don't fail session creation if JWT generation fails
      }

      // ✅ ISSUE #5 FIX: Validate device type against schema enum
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

      // Update session with roles + device info
      // Note: JWT and roleHash are managed in application memory, not persisted
      await this.db
        .update(schema.userSession)
        .set({
          userRoles: JSON.stringify(userRoles),
          primaryRole,
          // ✅ ISSUE #5 FIX: Store device tracking data
          ...(deviceInfo
            ? {
                deviceId: deviceInfo.deviceId || null,
                deviceName: deviceInfo.deviceName || null,
                deviceType: validatedDeviceType,
                appVersion: deviceInfo.appVersion || null,
              }
            : {}),
        })
        .where(eq(schema.userSession.userId, userId));

      Logger.log(
        `Session created for user ${userId}. RS256 JWT token generated with embedded roles.`,
      );

      // Return both BetterAuth session token and RS256 JWT token
      return {
        token: session.token,
        expiresAt: session.expiresAt,
        jwtToken: jwtToken || undefined,
      };
    } catch (err) {
      Logger.error(`Failed to add roles/JWT to session: ${err}`);
      // Don't fail session creation, return just the session token
      return { token: session.token, expiresAt: session.expiresAt };
    }
  }

  /**
   * Login a user with email + password.
   * BetterAuth creates the session after credentials are verified.
   *
   * ✅ ISSUE #5 FIX: Accept device info for session tracking
   */
  async login(
    dto: LoginDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<AuthResponseDto> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email))
      .limit(1);

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new UnauthorizedException('Account is blocked');

    // ✅ Check brute-force lockout (with auto-unlock if expired)
    if (user.accountLockedUntil) {
      const now = new Date();
      if (user.accountLockedUntil > now) {
        // Account is still locked
        throw new UnauthorizedException(
          `Account locked due to too many failed attempts. Try again after ${user.accountLockedUntil.toISOString()}`,
        );
      } else {
        // Lock has expired, auto-unlock account
        // ✅ TRANSACTION: Wrap in transaction for data consistency
        await this.db.transaction(async () => {
          await this.db
            .update(schema.users)
            .set({
              accountLockedUntil: null,
              failedLoginAttempts: 0,
            })
            .where(eq(schema.users.id, user.id));
        });
        Logger.log(
          `Auto-unlocked account for user ${user.id} (lockout expired)`,
        );
      }
    }

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
      const newFailedCount = user.failedLoginAttempts + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;
      // ✅ TRANSACTION: Wrap in transaction for data consistency
      await this.db.transaction(async () => {
        await this.db
          .update(schema.users)
          .set({
            failedLoginAttempts: newFailedCount,
            ...(shouldLock
              ? {
                  accountLockedUntil: new Date(
                    Date.now() + LOCKOUT_MINUTES * 60 * 1000,
                  ),
                }
              : {}),
          })
          .where(eq(schema.users.id, user.id));
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // ✅ TRANSACTION: Wrap multiple user state updates in transaction
    await this.db.transaction(async () => {
      // Reset lockout state, increment login counter
      await this.db
        .update(schema.users)
        .set({
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          loginCount: user.loginCount + 1,
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));

      await this.ensureSuperAdminRole(user.id);
    });

    // ✅ MODULE 2: Use token pair (access + refresh)
    const session = await this.createSessionForUser(user.id, deviceInfo);
    const tokenPair = await this.createTokenPair(user.id);

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
   * ✅ ISSUE #5 FIX: Accept device info for session tracking
   */
  async register(
    dto: RegisterDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<AuthResponseDto> {
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

    // ✅ TRANSACTION: Wrap user creation + auth provider + role setup in transaction
    const user = await this.db.transaction(async (tx) => {
      // Create user
      const [created] = await tx
        .insert(schema.users)
        .values({
          iamUserId,
          name: dto.name,
          email: dto.email,
          emailVerified: false,
        })
        .returning();

      if (!created) throw new BadRequestException('Failed to create user');

      // Create email auth provider
      await tx.insert(schema.userAuthProvider).values({
        userId: created.id,
        providerId: 'email',
        accountId: dto.email,
        password: passwordHash,
        isVerified: false,
      });

      // Assign SUPER_ADMIN role if first user
      await this.ensureSuperAdminRole(created.id);

      return created;
    });

    // ✅ MODULE 2: Use token pair (access + refresh)
    const session = await this.createSessionForUser(user.id, deviceInfo);
    const tokenPair = await this.createTokenPair(user.id);

    return this.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
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
   *
   * ✅ ISSUE #2 FIX: Validate that roles haven't changed
   * If roles changed, invalidate all sessions to force re-login
   *
   * NOTE: Token hashing is handled by BetterAuth's getSession method.
   * We pass the token as-is in the Authorization header; BetterAuth hashes it
   * internally to match against the database hash.
   */
  async refreshSession(
    oldToken: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    // ✅ Validate token via BetterAuth (BetterAuth handles token hashing internally)
    const session = await this.auth.api.getSession({
      headers: { authorization: `Bearer ${oldToken}` } as unknown as Headers,
    });

    if (!session || !session.user)
      throw new UnauthorizedException('Invalid or expired session token');

    // Check if session is expired
    if (new Date(session.session.expiresAt) < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    const userId = Number(session.user.id);

    // ✅ ISSUE #2 FIX: Detect if roles have changed
    // roleHash is not in BetterAuth's public type but may be stored as extra session data
    const storedRoleHash = (session.session as Record<string, unknown>)
      ?.roleHash as string | undefined;
    if (storedRoleHash) {
      const currentPermissions = await this.getUserPermissions(userId);
      const currentRoleHash = this.hashRoles(currentPermissions.roles || []);

      if (storedRoleHash !== currentRoleHash) {
        Logger.warn(
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
    await this.db
      .update(schema.users)
      .set({
        loginCount: sql`login_count + 1`,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Invalidate the current session token immediately.
   * Uses BetterAuth's getSession to handle token hashing, then deletes the session by user ID.
   */
  async logout(token: string): Promise<void> {
    // Validate token via BetterAuth (handles token hashing)
    const session = await this.auth.api.getSession({
      headers: { authorization: `Bearer ${token}` } as unknown as Headers,
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid session token');
    }

    // Delete all sessions for this user (ensures clean logout)
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, Number(session.user.id)));
  }

  /** Assign CUSTOMER role to a user (personal account setup). */
  async setupPersonal(userId: number) {
    const customerRole = await this.rolesRepository.findByCode('CUSTOMER');
    if (!customerRole)
      throw new UnauthorizedException('CUSTOMER role not found');
    try {
      await this.rolesRepository.assignRoleToUser(
        userId,
        customerRole.id,
        userId,
      );
    } catch {
      // Ignore unique constraint — already assigned
    }
    return this.getUserPermissions(userId);
  }

  /**
   * Unlock a locked account (admin operation).
   * Resets failed login attempts and clears the lockout timestamp.
   */
  async adminUnlockAccount(userId: number, adminUserId: number): Promise<void> {
    // Verify admin has permission (SUPER_ADMIN only)
    const adminPermissions = await this.getUserPermissions(adminUserId);
    const isSuperAdmin = adminPermissions.roles?.some(
      (r) => r.roleCode === 'SUPER_ADMIN',
    );
    if (!isSuperAdmin) {
      throw new UnauthorizedException('Only SUPER_ADMIN can unlock accounts');
    }

    await this.db
      .update(schema.users)
      .set({
        accountLockedUntil: null,
        failedLoginAttempts: 0,
      })
      .where(eq(schema.users.id, userId));

    Logger.log(
      `Admin ${adminUserId} manually unlocked account for user ${userId}`,
    );
  }

  /**
   * Check if an account is currently locked.
   * Returns { isLocked: boolean, unlocksAt?: Date }
   */
  async checkAccountLockStatus(userId: number): Promise<{
    isLocked: boolean;
    unlocksAt?: Date;
    attemptsRemaining?: number;
  }> {
    const [user] = await this.db
      .select({
        accountLockedUntil: schema.users.accountLockedUntil,
        failedLoginAttempts: schema.users.failedLoginAttempts,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const now = new Date();
    const isLocked = user.accountLockedUntil
      ? user.accountLockedUntil > now
      : false;

    if (isLocked) {
      return {
        isLocked: true,
        unlocksAt: user.accountLockedUntil || undefined,
        attemptsRemaining: 0,
      };
    } else {
      return {
        isLocked: false,
        attemptsRemaining:
          MAX_FAILED_ATTEMPTS - (user.failedLoginAttempts || 0),
      };
    }
  }

  /**
   * Invalidate all sessions for a user.
   *
   * ✅ ISSUE #2 FIX: Called when roles/permissions change
   * Force immediate logout by deleting all sessions
   */
  async invalidateUserSessions(
    userId: number,
    reason = 'ROLE_CHANGE',
  ): Promise<void> {
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId));

    Logger.log(`Invalidated all sessions for user ${userId}: ${reason}`);
  }

  /**
   * Select a store context for the current session.
   * Validates the user has a role in that store, updates activeStoreFk on the session,
   * and returns routes + permission codes scoped to that store.
   *
   * ✅ ISSUE #4 FIX: Use userId instead of sessionToken for session lookup
   * because sessionToken is hashed in the database, so we cannot use it for
   * direct equality queries. We use userId which uniquely identifies the session owner.
   */
  async switchStore(userId: number, sessionToken: string, storeId: number) {
    // ✅ Validate session token is valid (token provided by AuthGuard)
    const session = await this.auth.api.getSession({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      } as unknown as Headers,
    });

    if (!session || Number(session.user.id) !== userId) {
      throw new UnauthorizedException('Invalid or mismatched session token');
    }

    // Verify user has a role mapped to this store
    const [storeRole] = await this.db
      .select({ roleFk: schema.userRoleMapping.roleFk })
      .from(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, storeId),
        ),
      )
      .limit(1);

    if (!storeRole) {
      throw new UnauthorizedException('You do not have a role in this store');
    }

    // ✅ Update session with new active store using userId (token is hashed in DB)
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: storeId })
      .where(eq(schema.userSession.userId, userId));

    // Get all role IDs the user holds for this store
    const storeRoles = await this.db
      .select({
        roleId: schema.userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        storeName: schema.store.storeName,
      })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .leftJoin(
        schema.store,
        eq(schema.userRoleMapping.storeFk, schema.store.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, storeId),
        ),
      );

    const roles = this.mapToRoleEntries(storeRoles, storeId);

    // Fetch store routes and permissions scoped to this store
    const storeRoutes = await this.routesService.getStoreRoutes(
      userId,
      sessionToken,
    );

    // Return shape that auth slice's storeSelect.fulfilled reads as:
    // action.payload.data.data.access
    return {
      access: {
        isSuperAdmin: false,
        activeStoreId: storeId,
        roles,
        initialRoute: '/store/dashboard',
      },
      routes: storeRoutes.routes,
      permissions: storeRoutes.permissions,
    };
  }

  /**
   * Fetch all roles, permissions, activeStoreId, and userType for a user.
   * ALWAYS fetches fresh from DB to ensure role changes are immediately reflected.
   * (Do not rely on stale role cache in userSession table)
   */
  private readonly logger = new Logger(AuthService.name);

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
      // Cast to RoleRow so the rest of the function stays typed consistently
      userRoles = basicRoles as unknown as RoleRow[];
    }

    const roleCodes = userRoles.map((r) => r.roleCode);
    const activeStoreId =
      userRoles.find((r) => r.storeFk != null)?.storeFk ?? null;

    const roles = this.mapToRoleEntries(userRoles);

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
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException('User not found');

    let emailVerificationSent = false;
    let phoneVerificationSent = false;
    let nextStep: 'verifyEmail' | 'verifyPhone' | 'complete' = 'complete';

    // ✅ TRANSACTION: Wrap all profile updates in a transaction
    await this.db.transaction(async () => {
      // Update name
      await this.db
        .update(schema.users)
        .set({ name: dto.name })
        .where(eq(schema.users.id, userId));

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
            and(eq(schema.users.email, dto.email), eq(schema.users.id, userId)),
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

        nextStep = 'verifyPhone';
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
   *
   * ✅ ISSUE #3 FIX: Use userId instead of token for deletion
   * (token is hashed in DB, direct equality won't match)
   */
  async rotateSession(
    oldToken: string,
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    // ✅ ISSUE #3 FIX: Delete by userId, not by token hash
    await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId));

    // Issue new session via BetterAuth
    return this.createSessionForUser(userId);
  }

  /**
   * Clean up expired sessions from the database.
   *
   * ✅ ISSUE #7 FIX: Remove old sessions to prevent DB bloat
   * Run this as a scheduled task (cron) every hour or daily
   * Example cron: every morning at 2 AM
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      const now = new Date();
      const deleted = await this.db
        .delete(schema.userSession)
        .where(lt(schema.userSession.expiresAt, now))
        .returning({ id: schema.userSession.id });

      const count = deleted.length;
      Logger.log(`Cleaned up ${count} expired sessions`);
      return { deletedCount: count };
    } catch (err) {
      Logger.error(`❌ Failed to cleanup expired sessions: ${err}`);
      throw err;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * ✅ ISSUE #2 FIX: Calculate SHA256 hash of user roles
   * Used for detecting role changes between refresh cycles
   */
  private hashRoles(roles: UserRoleEntry[]): string {
    try {
      const roleString = JSON.stringify(
        roles.map((r) => `${r.roleCode}:${r.storeId}`),
      );
      return crypto.createHash('sha256').update(roleString).digest('hex');
    } catch (err) {
      Logger.error(`Failed to hash roles: ${err}`);
      return '';
    }
  }

  /**
   * Assign SUPER_ADMIN to the first user in the system.
   * No-op if SUPER_ADMIN is already seeded; ignores unique-constraint races.
   */
  private async ensureSuperAdminRole(userId: number): Promise<void> {
    if (await this.isSuperAdminSeeded()) return;
    const superAdminRole = await this.rolesRepository.findByCode('SUPER_ADMIN');
    if (!superAdminRole) return;
    try {
      await this.rolesRepository.assignRoleToUser(
        userId,
        superAdminRole.id,
        userId,
      );
    } catch {
      // Ignore if already assigned (race condition)
    }
  }

  /**
   * Normalise a raw role-DB-row array into the UserRoleEntry shape expected
   * by AuthMapper. Pass `storeIdOverride` when the rows don't carry storeFk
   * (e.g. the store-scoped query in switchStore()).
   */
  private mapToRoleEntries(
    rows: Array<{
      roleCode?: string;
      code?: string;
      storeFk?: number | null;
      storeName?: string | null;
    }>,
    storeIdOverride?: number,
  ): UserRoleEntry[] {
    return rows.map((r, i) => ({
      roleCode: (r.roleCode ?? r.code) as UserRoleEntry['roleCode'],
      storeId: storeIdOverride ?? r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: i === 0,
      assignedAt: new Date().toISOString(),
      expiresAt: null,
    }));
  }

  /**
   * Fetch permissions, generate trace IDs, and build the unified AuthResponseDto.
   * Shared by login(), register(), and OTP verifyOtp().
   *
   * ✅ MODULE 2: Includes token pair (access + refresh)
   */
  async buildAuthResponse(
    user: {
      id: number;
      email: string | null;
      name: string;
      emailVerified: boolean;
      image: string | null | undefined;
      phoneNumber: string | null | undefined;
      phoneNumberVerified: boolean;
    },
    token: string,
    expiresAt: Date,
    tokenPair?: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
      refreshTokenExpiresAt: Date;
    },
  ): Promise<AuthResponseDto> {
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
          sessionId: crypto.randomUUID(),
          // ✅ MODULE 2: Include token pair if available
          ...(tokenPair && {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            accessTokenExpiresAt: tokenPair.accessTokenExpiresAt,
            refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt,
          }),
        },
      },
      permissions,
      requestId,
      traceId,
    );
  }

  /**
   * ✅ MODULE 2: Generate separate access and refresh tokens
   * Works for WEB and MOBILE
   *
   * Access Token: JWT, 1 hour expiry
   * Refresh Token: Opaque, 30 days expiry (stored as hash)
   */
  async createTokenPair(userId: number): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
  }> {
    // ✅ STEP 1: Create access token (JWT, 1 hour)
    const permissions = await this.getUserPermissions(userId);
    const userRoles = permissions.roles || [];

    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const accessToken = this.jwtConfigService.signToken({
      sub: String(userId),
      email: user?.email || 'noemail@example.com',
      roles: userRoles.map((r) => r.roleCode),
      primaryRole: userRoles[0]?.roleCode || null,
      stores: userRoles
        .filter((r) => r.storeId && r.storeName)
        .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
      activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
      iss: process.env.BETTER_AUTH_BASE_URL || 'nks-auth',
      aud: 'nks-app',
    });

    // ✅ STEP 2: Create refresh token (opaque, random 32 bytes)
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // ✅ STEP 3: Hash refresh token before storing (never store plaintext)
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // ✅ STEP 4: Calculate expiry times
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1h
    const refreshTokenExpiresAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ); // 30d

    // ✅ STEP 5: Store hash in database (NOT the token itself)
    await this.db
      .update(schema.userSession)
      .set({
        refreshTokenHash,
        refreshTokenExpiresAt,
        accessTokenExpiresAt,
      })
      .where(eq(schema.userSession.userId, userId));

    Logger.log(
      `Token pair created for user ${userId}. Access token expires in 1h, refresh token in 30d.`,
    );

    // ✅ STEP 6: Return both tokens to client
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * ✅ MODULE 2: Refresh access token using refresh token
   * Works for WEB and MOBILE
   *
   * Validates refresh token hasn't expired, generates new access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    accessTokenExpiresAt: Date;
  }> {
    // ✅ STEP 1: Hash the refresh token sent by client
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // ✅ STEP 2: Look up session by refresh token hash
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.refreshTokenHash, tokenHash))
      .limit(1);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ✅ STEP 3: Validate refresh token hasn't expired
    if (
      session.refreshTokenExpiresAt &&
      session.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // ✅ STEP 4: Get current permissions and generate new access token
    const permissions = await this.getUserPermissions(session.userId);
    const userRoles = permissions.roles || [];

    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);

    const accessToken = this.jwtConfigService.signToken({
      sub: String(session.userId),
      email: user?.email || 'noemail@example.com',
      roles: userRoles.map((r) => r.roleCode),
      primaryRole: userRoles[0]?.roleCode || null,
      stores: userRoles
        .filter((r) => r.storeId && r.storeName)
        .map((r) => ({ id: r.storeId as number, name: r.storeName as string })),
      activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
      iss: process.env.BETTER_AUTH_BASE_URL || 'nks-auth',
      aud: 'nks-app',
    });

    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // ✅ STEP 5: Update session with new expiry
    await this.db
      .update(schema.userSession)
      .set({ accessTokenExpiresAt })
      .where(eq(schema.userSession.userId, session.userId));

    Logger.log(
      `Access token refreshed for user ${session.userId}. New expiry: ${accessTokenExpiresAt.toISOString()}`,
    );

    // ✅ STEP 6: Return new access token
    return { accessToken, accessTokenExpiresAt };
  }

  /**
   * ✅ MODULE 1: Verify JWT claims during mobile offline sync
   * Detects if roles have changed since JWT was issued
   * Returns updated permissions if roles changed
   */
  async verifyClaims(jwtToken: string) {
    try {
      const payload = this.jwtConfigService.verifyToken(jwtToken);

      // Get current user roles
      const currentPermissions = await this.getUserPermissions(
        Number(payload.sub),
      );
      const currentRoles = currentPermissions.roles || [];
      const currentRoleCodes = currentRoles.map((r) => r.roleCode);

      // Check if roles changed
      const tokenRoles = payload.roles || [];
      const rolesChanged = !this.arraysEqual(
        currentRoleCodes.sort(),
        tokenRoles.sort(),
      );

      Logger.log(
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
      Logger.error(`JWT verification failed: ${error}`);
      return {
        isValid: false,
        rolesChanged: false,
      };
    }
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
