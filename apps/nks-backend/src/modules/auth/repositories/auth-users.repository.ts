import { Injectable } from '@nestjs/common';
import { eq, and, isNull, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type {
  User as DbUser,
  NewUser,
} from '../../../core/database/schema/auth/users';

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
export class AuthUsersRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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
   * Update login info (last login time, login count)
   */
  async recordLogin(userId: number): Promise<void> {
    await this.db
      .update(schema.users)
      .set({
        lastLoginAt: new Date(),
        loginCount: sql`login_count + 1`,
      })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Find user by phone
   */
  async findByPhoneOrNull(phone: string): Promise<DbUser | null> {
    return this.findByPhone(phone);
  }

  /**
   * Find user by email
   */
  async findByEmailOrNull(email: string): Promise<DbUser | null> {
    return this.findByEmail(email);
  }

  /**
   * Fetch only email + guuid for a user by ID.
   * Used for JWT signing — avoids loading full user row.
   */
  async findEmailAndGuuid(
    userId: number,
  ): Promise<{ email: string | null; guuid: string } | null> {
    const [user] = await this.db
      .select({ email: schema.users.email, guuid: schema.users.guuid })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
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
        and(eq(schema.users.email, email), ne(schema.users.id, excludeUserId)),
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
        and(eq(schema.users.phoneNumber, phone), eq(schema.users.id, userId)),
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
        loginCount: sql`login_count + 1`,
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
   * Increment the permissions version for a user.
   * Called when roles or permissions change.
   */
  async incrementPermissionsVersion(userId: number): Promise<string> {
    const [user] = await this.db
      .select({ permissionsVersion: schema.users.permissionsVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) return 'v1';

    const newVersion = this.incrementVersion(user.permissionsVersion ?? 'v1');

    await this.db
      .update(schema.users)
      .set({ permissionsVersion: newVersion })
      .where(eq(schema.users.id, userId));

    return newVersion;
  }

  /**
   * Get all active store IDs for a user.
   * Used for building the permissions snapshot across all stores.
   */
  async findActiveStoreIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ storeId: schema.storeUserMapping.storeFk })
      .from(schema.storeUserMapping)
      .where(
        and(
          eq(schema.storeUserMapping.userFk, userId),
          eq(schema.storeUserMapping.isActive, true),
        ),
      );

    return rows.map((r) => r.storeId).filter((id): id is number => id !== null);
  }

  /**
   * Increment version string from format "vN" to "v(N+1)".
   * Extracts numeric part, increments, and reconstructs.
   */
  private incrementVersion(currentVersion: string): string {
    const versionNum = parseInt(currentVersion.substring(1), 10) || 1;
    return `v${versionNum + 1}`;
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
      password: string;
      isVerified: boolean;
    },
    onRoleAssignment: (
      tx: NodePgDatabase<typeof schema>,
      userId: number,
    ) => Promise<void>,
  ): Promise<DbUser | null> {
    try {
      const user = await this.db.transaction(async (tx) => {
        // Step 1: Create user
        const [created] = await tx
          .insert(schema.users)
          .values(userData)
          .returning();

        if (!created) return null;

        // Step 2: Create auth provider
        await tx.insert(schema.userAuthProvider).values({
          userId: created.id,
          providerId: authProviderData.providerId,
          accountId: authProviderData.accountId,
          password: authProviderData.password,
          isVerified: authProviderData.isVerified,
        });

        // Step 3: Assign initial role (SUPER_ADMIN if first, else USER)
        // Callback handles the role resolution and assignment with proper transaction context
        await onRoleAssignment(tx, created.id);

        return created;
      });

      return user ?? null;
    } catch (err) {
      // SECURITY: Handle unique constraint violation (email already exists)
      // PostgreSQL error code 23505 = unique constraint violation
      if ((err as { code?: string }).code === '23505') {
        // Treat as null rather than throwing — lets caller decide action
        return null;
      }
      throw err;
    }
  }
}
