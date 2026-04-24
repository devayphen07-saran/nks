import { Injectable } from '@nestjs/common';
import { PG_UNIQUE_VIOLATION } from '../../../../common/constants/pg-error-codes';
import { eq, and, isNull, isNotNull, lte, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import type { DbTransaction } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import type {
  User as DbUser,
  NewUser,
} from '../../../../core/database/schema/auth/users';

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
  async findByEmail(email: string): Promise<DbUser | null> {
    const [user] = await this.db
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
        lastActiveAt: new Date(),
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
   * Create a new user
   * Returns the created user or null if creation failed.
   * Caller should decide how to handle null result.
   */
  async create(data: NewUser): Promise<DbUser | null> {
    const [user] = await this.db.insert(schema.users).values(data).returning();
    return user ?? null;
  }

  /**
   * Update user (partial update)
   * Returns the updated user or null if user not found.
   * Caller should decide how to handle null result.
   */
  async update(
    userId: number,
    data: Partial<Omit<DbUser, 'id' | 'createdAt' | 'guuid'>>,
    tx?: Db,
  ): Promise<DbUser | null> {
    const conn = tx ?? this.db;
    const [user] = await conn
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, userId))
      .returning();

    return user ?? null;
  }

  /**
   * Mark email as verified
   */
  async verifyEmail(userId: number): Promise<void> {
    await this.db
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
  async markProfileComplete(userId: number, tx?: Db): Promise<void> {
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
   * Update lastActiveAt for a user. Called by AuthGuard on every authenticated request,
   * throttled externally (once per 5 minutes) to limit write frequency.
   */
  async touchLastActiveAt(userId: number): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Fetch only email + guuid for a user by ID.
   * Used for JWT signing — avoids loading full user row.
   */
  async findEmailAndGuuid(
    userId: number,
  ): Promise<{ email: string | null; guuid: string; iamUserId: string; defaultStoreFk: number | null } | null> {
    const [user] = await this.db
      .select({
        email: schema.users.email,
        guuid: schema.users.guuid,
        iamUserId: schema.users.iamUserId,
        defaultStoreFk: schema.users.defaultStoreFk,
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
    tx?: Db,
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
  async phoneLinkedToUser(phone: string, userId: number, tx?: Db): Promise<boolean> {
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
   * Increment loginCount and set lastLoginAt + lastActiveAt atomically.
   * Called from OTP and OAuth paths that don't go through login().
   */
  async recordSuccessfulLogin(userId: number): Promise<void> {
    await this.db
      .update(schema.users)
      .set({
        loginCount: sql`${schema.users.loginCount} + 1`,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Get the permissions version string for a user.
   * Used for mobile offline sync delta calculation.
   */
  async getPermissionsVersion(userId: number): Promise<string> {
    const [user] = await this.db
      .select({ permissionsVersion: schema.users.permissionsVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user?.permissionsVersion ?? 'v1';
  }

  /**
   * Increment the permissions version for a user atomically.
   * Called when roles or permissions change.
   * Uses SQL-level SUBSTRING + CAST to avoid read-compute-write races.
   */
  async incrementPermissionsVersion(userId: number): Promise<string> {
    const [updated] = await this.db
      .update(schema.users)
      .set({
        permissionsVersion: sql`'v' || (COALESCE(CAST(SUBSTRING(${schema.users.permissionsVersion} FROM 2) AS INTEGER), 0) + 1)`,
      })
      .where(eq(schema.users.id, userId))
      .returning({ permissionsVersion: schema.users.permissionsVersion });

    return updated?.permissionsVersion ?? 'v1';
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
    onRoleAssignment: (
      tx: DbTransaction,
      userId: number,
    ) => Promise<void>,
  ): Promise<DbUser | null> {
    try {
      const user = await this.txService.run(async (tx) => {
        // Step 1: Create user
        const [created] = await tx
          .insert(schema.users)
          .values(userData)
          .returning();

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
}
