import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { UserAuthProvider, NewUserAuthProvider } from '../../../../core/database/schema/auth/user-auth-provider';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuthProviderRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async findByUserIdAndProvider(
    userId: number,
    providerId: string,
  ): Promise<UserAuthProvider | null> {
    const [provider] = await this.db
      .select()
      .from(schema.userAuthProvider)
      .where(
        and(
          eq(schema.userAuthProvider.userId, userId),
          eq(schema.userAuthProvider.providerId, providerId),
        ),
      )
      .limit(1);

    return provider ?? null;
  }

  async findIdByUserIdAndProvider(
    userId: number,
    providerId: string,
    tx?: Db,
  ): Promise<number | null> {
    const conn = tx ?? this.db;
    const [provider] = await conn
      .select({ id: schema.userAuthProvider.id })
      .from(schema.userAuthProvider)
      .where(
        and(
          eq(schema.userAuthProvider.userId, userId),
          eq(schema.userAuthProvider.providerId, providerId),
        ),
      )
      .limit(1);

    return provider?.id ?? null;
  }

  async create(data: NewUserAuthProvider, tx?: Db): Promise<UserAuthProvider | null> {
    const conn = tx ?? this.db;
    const [provider] = await conn
      .insert(schema.userAuthProvider)
      .values(data)
      .returning();

    return provider ?? null;
  }

  async updatePassword(providerId: number, passwordHash: string, tx?: Db): Promise<void> {
    const conn = tx ?? this.db;
    await conn
      .update(schema.userAuthProvider)
      .set({ password: passwordHash })
      .where(eq(schema.userAuthProvider.id, providerId));
  }

  async updateVerification(
    providerId: number,
    isVerified: boolean,
    verifiedAt?: Date,
  ): Promise<void> {
    await this.db
      .update(schema.userAuthProvider)
      .set({
        isVerified,
        verifiedAt: verifiedAt || new Date(),
      })
      .where(eq(schema.userAuthProvider.id, providerId));
  }
}
