import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { UserAuthProvider, NewUserAuthProvider } from '../../../core/database/schema/auth/user-auth-provider';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuthProviderRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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
  ): Promise<number | null> {
    const [provider] = await this.db
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

  async create(data: NewUserAuthProvider): Promise<UserAuthProvider | null> {
    const [provider] = await this.db
      .insert(schema.userAuthProvider)
      .values(data)
      .returning();

    return provider ?? null;
  }

  async updatePassword(providerId: number, passwordHash: string): Promise<void> {
    await this.db
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
