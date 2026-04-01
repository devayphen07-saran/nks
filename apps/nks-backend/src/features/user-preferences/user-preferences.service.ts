import { Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';

@Injectable()
export class UserPreferencesService {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Get or create user preferences.
   * Creates with defaults if doesn't exist.
   */
  async getOrCreate(userId: number, createdBy: number) {
    const existing = await this.get(userId);
    if (existing) return existing;

    return this.db
      .insert(schema.userPreferences)
      .values({
        userFk: userId,
        theme: 'light',
        notificationsEnabled: true,
        createdBy,
      })
      .returning()
      .then((rows: schema.UserPreferences[]) => rows[0]);
  }

  /**
   * Get user preferences.
   */
  async get(userId: number) {
    return this.db
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.userFk, userId),
          isNull(schema.userPreferences.deletedAt),
        ),
      )
      .then((rows: schema.UserPreferences[]) => rows[0]);
  }

  /**
   * Update user preferences.
   */
  async update(
    userId: number,
    data: Partial<schema.UserPreferences>,
    modifiedBy: number,
  ) {
    return this.db
      .update(schema.userPreferences)
      .set({
        ...data,
        modifiedBy,
      })
      .where(eq(schema.userPreferences.userFk, userId))
      .returning()
      .then((rows: schema.UserPreferences[]) => rows[0]);
  }

  /**
   * Set theme preference.
   */
  async setTheme(userId: number, theme: string, modifiedBy: number) {
    return this.update(userId, { theme }, modifiedBy);
  }

  /**
   * Set timezone preference.
   */
  async setTimezone(userId: number, timezone: string, modifiedBy: number) {
    return this.update(userId, { timezone }, modifiedBy);
  }

  /**
   * Soft delete user preferences.
   */
  async delete(userId: number, deletedBy: number) {
    return this.db
      .update(schema.userPreferences)
      .set({
        deletedAt: new Date(),
        deletedBy,
      })
      .where(eq(schema.userPreferences.userFk, userId));
  }
}
