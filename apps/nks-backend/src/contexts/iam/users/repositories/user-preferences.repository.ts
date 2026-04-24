import { Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type {
  UserPreferences,
  NewUserPreferences,
} from '../../../../core/database/schema/user-preferences';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class UserPreferencesRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async findByUserId(userId: number): Promise<UserPreferences | null> {
    const [prefs] = await this.db
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.userFk, userId),
          isNull(schema.userPreferences.deletedAt),
        ),
      )
      .limit(1);

    return prefs ?? null;
  }

  async create(data: NewUserPreferences): Promise<UserPreferences | null> {
    const [prefs] = await this.db
      .insert(schema.userPreferences)
      .values(data)
      .returning();

    return prefs ?? null;
  }

  async update(
    userId: number,
    data: Partial<
      Omit<UserPreferences, 'id' | 'userFk' | 'createdAt' | 'createdBy'>
    >,
  ): Promise<UserPreferences | null> {
    const [prefs] = await this.db
      .update(schema.userPreferences)
      .set({
        ...data,
      })
      .where(
        and(
          eq(schema.userPreferences.userFk, userId),
          isNull(schema.userPreferences.deletedAt),
        ),
      )
      .returning();

    return prefs ?? null;
  }

  async softDelete(userId: number, deletedBy: number): Promise<void> {
    await this.db
      .update(schema.userPreferences)
      .set({
        deletedAt: new Date(),
        deletedBy,
      })
      .where(eq(schema.userPreferences.userFk, userId));
  }
}
