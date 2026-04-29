import { Injectable } from '@nestjs/common';
import { PG_UNIQUE_VIOLATION } from '../../../../common/constants/pg-error-codes';
import { eq, and, isNull, isNotNull, lte, ne, sql, or, count, asc, desc } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import type { DbTransaction } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import {
  ilikeAny,
  ilikeFullName,
} from '../../../../core/database/query-helpers';
import type {
  User as DbUser,
  NewUser,
} from '../../../../core/database/schema/auth/users';

/** Shape returned by admin user-management queries. */
export interface AdminUserRow {
  guuid: string;
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: Date;
  primaryRole: string | null;
}

type Db = NodePgDatabase<typeof schema>;

/**
 * AuthUsersRepository
 * Specialized repository for auth operations on users
 * Responsibilities:
 * - Find users by email/phone
 * - Create users
 * - Update user profile completion
 * - Verify email/phone
 * - Check SUPER_ADMIN existence
 */
@Injectable()
export class AuthUsersRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

  /**
   * Find user by email
   */
  async findByEmail(email: string, tx?: DbTransaction): Promise<DbUser | null> {
    const conn = tx ?? this.db;
    const [user] = await conn
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  /**
   * Find user + email provider password in a single JOIN.
   * Replaces the two-query pattern (findByEmail + findByUserIdAndProvider)
   * used on every login request.
   */
  async findByEmailWithPassword(
    email: string,
  ): Promise<{ user: DbUser; passwordHash: string } | null> {
    const [row] = await this.db
      .select({
        user: schema.users,
        passwordHash: schema.userAuthProvider.password,
      })
      .from(schema.users)
      .innerJoin(
        schema.userAuthProvider,
        and(
          eq(schema.userAuthProvider.userId, schema.users.id),
          eq(schema.userAuthProvider.providerId, 'email'),
        ),
      )
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1);

    if (!row?.passwordHash) return null;
    return { user: row.user, passwordHash: row.passwordHash };
  }

  /**
   * Reset failed login counters and record the successful login in one atomic write.
   * Replaces the two-query pattern (update + recordLogin) on every successful login.
   */
  async resetAndRecordLogin(userId: number): Promise<DbUser | null> {
    const [user] = await this.db
      .update(schema.users)
      .set({
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLoginAt: new Date(),
        loginCount: sql`${schema.users.loginCount} + 1`,
      })
      .where(eq(schema.users.id, userId))
      .returning();

    return user ?? null;
  }

  /**
   * Find user by phone number
   */
  async findByPhone(phone: string): Promise<DbUser | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.phoneNumber, phone),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<DbUser | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  /**
   * Find user by UUID (GUUID)
   */
  async findByGuuid(guuid: string): Promise<DbUser | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.guuid, guuid), isNull(schema.users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async findByIamUserId(iamUserId: string): Promise<DbUser | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.iamUserId, iamUserId),
          eq(schema.users.isActive, true),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  /**
   * Create a new user with audit tracking
   * Returns the created user or null if creation failed.
   * Caller should decide how to handle null result.
   */
  async create(data: NewUser, createdBy: number): Promise<DbUser | null> {
    return this.insertOneAudited(schema.users, data, createdBy);
  }

  /**
   * Update user (partial update) with audit tracking
   * Returns the updated user or null if user not found.
   * Caller should decide how to handle null result.
   */
  async update(
    userId: number,
    data: Partial<Omit<DbUser, 'id' | 'createdAt' | 'guuid'>>,
    modifiedBy: number,
    tx?: DbTransaction,
  ): Promise<DbUser | null> {
    return this.updateOneAudited(
      schema.users,
      data,
      eq(schema.users.id, userId),
      modifiedBy,
      tx,
    );
  }

  /**
   * Mark email as verified
   */
  async verifyEmail(userId: number, tx?: DbTransaction): Promise<void> {
    const conn = tx ?? this.db;
    await conn
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Mark phone as verified
   */
  async verifyPhone(userId: number): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ phoneNumberVerified: true })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Mark profile as complete
   */
  async markProfileComplete(userId: number, tx?: DbTransaction): Promise<void> {
    const conn = tx ?? this.db;
    await conn
      .update(schema.users)
      .set({ profileCompleted: true })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Atomically increment the failed login counter and return the new count.
   * Uses SQL-level arithmetic to prevent lost-update races under concurrent requests.
   */
  async incrementFailedAttempts(userId: number): Promise<number> {
    const [row] = await this.db
      .update(schema.users)
      .set({ failedLoginAttempts: sql`${schema.users.failedLoginAttempts} + 1` })
      .where(eq(schema.users.id, userId))
      .returning({ count: schema.users.failedLoginAttempts });
    return row?.count ?? 0;
  }

  /**
   * Lock the account until the given timestamp.
   * Conditional on accountLockedUntil IS NULL to prevent concurrent requests
   * from extending an existing lockout window.
   */
  async lockAccount(userId: number, until: Date): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ accountLockedUntil: until })
      .where(
        and(eq(schema.users.id, userId), isNull(schema.users.accountLockedUntil)),
      );
  }

  /**
   * Conditionally unlock an account whose lockout has expired.
   * WHERE accountLockedUntil IS NOT NULL AND accountLockedUntil <= NOW() prevents
   * two concurrent requests from both resetting the lock (CAS-safe auto-unlock).
   * Returns true if the row was updated, false if the lock was already cleared by
   * a concurrent request or the lock has not yet expired.
   */
  async autoUnlockIfExpired(userId: number): Promise<boolean> {
    const now = new Date();
    const [row] = await this.db
      .update(schema.users)
      .set({ accountLockedUntil: null, failedLoginAttempts: 0 })
      .where(
        and(
          eq(schema.users.id, userId),
          isNotNull(schema.users.accountLockedUntil),
          lte(schema.users.accountLockedUntil, now),
        ),
      )
      .returning({ id: schema.users.id });
    return !!row;
  }

  /**
   * Fetch the minimal user fields required to build an auth response envelope.
   * Used by token rotation (refresh) and session creation flows.
   */
  async findEmailAndGuuid(
    userId: number,
  ): Promise<{
    email: string | null;
    guuid: string;
    iamUserId: string;
    defaultStoreFk: number | null;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
  } | null> {
    const [user] = await this.db
      .select({
        email: schema.users.email,
        guuid: schema.users.guuid,
        iamUserId: schema.users.iamUserId,
        defaultStoreFk: schema.users.defaultStoreFk,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phoneNumber: schema.users.phoneNumber,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, userId),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  /**
   * Check whether an email is already used by a different user.
   * Used in profileComplete() to prevent email conflicts.
   */
  async emailExistsForOtherUser(
    email: string,
    excludeUserId: number,
    tx?: DbTransaction,
  ): Promise<boolean> {
    const conn = tx ?? this.db;
    const [row] = await conn
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.email, email),
          ne(schema.users.id, excludeUserId),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return !!row;
  }

  /**
   * Check whether a phone number is already linked to a specific user.
   * Used in profileComplete() to skip re-setting the same phone.
   */
  async phoneLinkedToUser(phone: string, userId: number, tx?: DbTransaction): Promise<boolean> {
    const conn = tx ?? this.db;
    const [row] = await conn
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.phoneNumber, phone),
          eq(schema.users.id, userId),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return !!row;
  }

  /**
   * Increment loginCount and set lastLoginAt atomically.
   * Called from OTP and OAuth paths that don't go through login().
   */
  async recordSuccessfulLogin(userId: number): Promise<void> {
    await this.db
      .update(schema.users)
      .set({
        loginCount: sql`${schema.users.loginCount} + 1`,
        lastLoginAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Get the permissions version string for a user.
   * Used for mobile offline sync delta calculation.
   */
  async getPermissionsVersion(userId: number): Promise<number> {
    const [user] = await this.db
      .select({ permissionsVersion: schema.users.permissionsVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user?.permissionsVersion ?? 1;
  }

  async incrementPermissionsVersion(userId: number): Promise<number> {
    const [updated] = await this.db
      .update(schema.users)
      .set({
        permissionsVersion: sql`${schema.users.permissionsVersion} + 1`,
      })
      .where(eq(schema.users.id, userId))
      .returning({ permissionsVersion: schema.users.permissionsVersion });

    return updated?.permissionsVersion ?? 1;
  }

  /**
   * Get all active store IDs for a user — staff memberships + owned stores.
   * Used for building the permissions snapshot across all stores.
   */
  async findActiveStoreIds(userId: number): Promise<number[]> {
    const [staffRows, ownedRows] = await Promise.all([
      this.db
        .select({ storeId: schema.storeUserMapping.storeFk })
        .from(schema.storeUserMapping)
        .where(
          and(
            eq(schema.storeUserMapping.userFk, userId),
            eq(schema.storeUserMapping.isActive, true),
          ),
        ),
      this.db
        .select({ storeId: schema.store.id })
        .from(schema.store)
        .where(
          and(
            eq(schema.store.ownerUserFk, userId),
            eq(schema.store.isActive, true),
            isNull(schema.store.deletedAt),
          ),
        ),
    ]);

    const staffIds = staffRows.map((r) => r.storeId).filter((id): id is number => id !== null);
    const ownedIds = ownedRows.map((r) => r.storeId).filter((id): id is number => id !== null);
    return [...new Set([...staffIds, ...ownedIds])];
  }

  /**
   * CRITICAL: Create user + auth provider + assign initial role in a single atomic transaction.
   *
   * This method encapsulates the entire user registration flow:
   * 1. Create user in database
   * 2. Create auth provider (email/password)
   * 3. Assign initial role (SUPER_ADMIN if first user, else USER)
   *
   * SECURITY: Wrapped in a single database transaction to prevent race conditions where
   * multiple concurrent requests could create multiple SUPER_ADMIN users.
   *
   * @param userData - User creation data (name, email, iamUserId)
   * @param authProviderData - Auth provider data (providerId, accountId, password, isVerified)
   * @param createdBy - User ID of who is creating this user (for audit trail)
   * @param onRoleAssignment - Callback to assign the initial role within the transaction
   *                           Receives (tx, userId) to handle role assignment with proper context
   * @returns The created user or null if creation failed
   * @throws Error if transaction fails (cascade rollback for all changes)
   *
   * Note: RolesRepository methods accept optional tx parameter for transaction usage.
   * Pass tx to all role-related queries within this transaction.
   */
  async createUserWithInitialRole(
    userData: NewUser,
    authProviderData: {
      providerId: string;
      accountId: string;
      password: string | null;
      isVerified: boolean;
    } | null,
    createdBy: number,
    onRoleAssignment: (
      tx: DbTransaction,
      userId: number,
    ) => Promise<void>,
  ): Promise<DbUser | null> {
    try {
      const user = await this.txService.run(async (tx) => {
        // Step 1: Create user with audit fields
        const created = await this.insertOneAudited(schema.users, userData, createdBy, tx);

        if (!created) return null;

        // Step 2: Create auth provider (only if provider data supplied)
        if (authProviderData) {
          await tx.insert(schema.userAuthProvider).values({
            userId: created.id,
            providerId: authProviderData.providerId,
            accountId: authProviderData.accountId,
            password: authProviderData.password,
            isVerified: authProviderData.isVerified,
          });
        }

        // Step 3: Assign initial role (SUPER_ADMIN if first, else USER)
        await onRoleAssignment(tx, created.id);

        return created;
      });

      return user ?? null;
    } catch (err) {
      // SECURITY: Handle unique constraint violation (email already exists)
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        // Treat as null rather than throwing — lets caller decide action
        return null;
      }
      throw err;
    }
  }

  // ─── Admin user-management queries ───────────────────────────────────────────

  private getUserOrderColumn(sortBy: string = 'createdAt'): AnyColumn {
    switch (sortBy) {
      case 'firstName': return schema.users.firstName;
      case 'email':     return schema.users.email;
      default:          return schema.users.createdAt;
    }
  }

  /** Fetch a single user by iamUserId for the admin/self-service profile endpoint. */
  async findAdminUserByIamUserId(iamUserId: string): Promise<AdminUserRow | null> {
    const [row] = await this.db
      .select({
        guuid:               schema.users.guuid,
        iamUserId:           schema.users.iamUserId,
        firstName:           schema.users.firstName,
        lastName:            schema.users.lastName,
        email:               schema.users.email,
        emailVerified:       schema.users.emailVerified,
        phoneNumber:         schema.users.phoneNumber,
        phoneNumberVerified: schema.users.phoneNumberVerified,
        image:               schema.users.image,
        isBlocked:           schema.users.isBlocked,
        blockedReason:       schema.users.blockedReason,
        createdAt:           schema.users.createdAt,
        primaryRole:         schema.roles.code,
      })
      .from(schema.users)
      .leftJoin(
        userRoleMapping,
        and(
          eq(userRoleMapping.userFk, schema.users.id),
          eq(userRoleMapping.isPrimary, true),
          eq(userRoleMapping.isActive, true),
          isNull(userRoleMapping.deletedAt),
        ),
      )
      .leftJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .where(and(eq(schema.users.iamUserId, iamUserId), isNull(schema.users.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  /** Paginated admin list of users with optional search, sort, and active filter. */
  async findAdminUserPage(opts: {
    page:      number;
    pageSize:  number;
    search?:   string;
    sortBy?:   string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<{ rows: AdminUserRow[]; total: number }> {
    const { page, pageSize, search, sortBy = 'createdAt', sortOrder = 'desc', isActive } = opts;
    const offset = AuthUsersRepository.toOffset(page, pageSize);

    const searchFilter = or(
      ilikeAny(search, schema.users.firstName, schema.users.lastName, schema.users.email, schema.users.phoneNumber),
      ilikeFullName(search, schema.users.firstName, schema.users.lastName),
    );

    const where = and(
      isNull(schema.users.deletedAt),
      isActive !== undefined ? eq(schema.users.isActive, isActive) : undefined,
      searchFilter,
    );

    return this.paginate(
      this.db
        .select({
          guuid:               schema.users.guuid,
          iamUserId:           schema.users.iamUserId,
          firstName:           schema.users.firstName,
          lastName:            schema.users.lastName,
          email:               schema.users.email,
          emailVerified:       schema.users.emailVerified,
          phoneNumber:         schema.users.phoneNumber,
          phoneNumberVerified: schema.users.phoneNumberVerified,
          image:               schema.users.image,
          isBlocked:           schema.users.isBlocked,
          blockedReason:       schema.users.blockedReason,
          createdAt:           schema.users.createdAt,
          primaryRole:         schema.roles.code,
        })
        .from(schema.users)
        .leftJoin(
          userRoleMapping,
          and(
            eq(userRoleMapping.userFk, schema.users.id),
            eq(userRoleMapping.isPrimary, true),
            eq(userRoleMapping.isActive, true),
            isNull(userRoleMapping.deletedAt),
          ),
        )
        .leftJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
        .where(where)
        .orderBy(
          sortOrder === 'desc'
            ? desc(this.getUserOrderColumn(sortBy))
            : asc(this.getUserOrderColumn(sortBy)),
        )
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(schema.users).where(where),
      page,
      pageSize,
    );
  }
}
