import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { User as DbUser, NewUser } from '../../../core/database/schema/auth/users';

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
      .where(
        and(
          eq(schema.users.email, email),
          isNull(schema.users.deletedAt),
        ),
      )
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
      .where(
        and(
          eq(schema.users.id, id),
          isNull(schema.users.deletedAt),
        ),
      )
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
      .where(
        and(
          eq(schema.users.guuid, guuid),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<DbUser> {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning();

    if (!user) {
      throw new BadRequestException('Failed to create user');
    }

    return user;
  }

  /**
   * Update user (partial update)
   */
  async update(
    userId: number,
    data: Partial<Omit<DbUser, 'id' | 'createdAt' | 'guuid'>>,
  ): Promise<DbUser> {
    const [user] = await this.db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
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
  async markProfileComplete(userId: number): Promise<void> {
    await this.db
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
   * Find or create user by phone
   * Used for OTP-based registration
   */
  async findOrCreateByPhone(
    phone: string,
    userData: Partial<NewUser> = {},
  ): Promise<DbUser> {
    let user = await this.findByPhone(phone);

    if (!user) {
      // Create new user
      user = await this.create({
        name: `User ${phone.slice(-4)}`,
        phoneNumber: phone,
        phoneNumberVerified: false,
        ...userData,
      } as NewUser);
    }

    return user;
  }

  /**
   * Find or create user by email
   * Used for email-based registration
   */
  async findOrCreateByEmail(
    email: string,
    userData: Partial<NewUser> = {},
  ): Promise<DbUser> {
    let user = await this.findByEmail(email);

    if (!user) {
      // Create new user
      user = await this.create({
        email,
        emailVerified: false,
        ...userData,
      } as NewUser);
    }

    return user;
  }
}
