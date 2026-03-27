import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../core/database/schema';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class UsersRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  /**
   * Find a user by primary key (Internal).
   * No tx? - Read only.
   */
  async findById(id: number) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user ?? null;
  }

  /**
   * Find an active user by email.
   * No tx? - Read only.
   */
  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(eq(schema.users.email, email), eq(schema.users.isActive, true)),
      )
      .limit(1);
    return user ?? null;
  }

  /**
   * Find an active user by phone number.
   * No tx? - Read only.
   */
  async findByPhone(phoneNumber: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.phoneNumber, phoneNumber),
          eq(schema.users.isActive, true),
        ),
      )
      .limit(1);
    return user ?? null;
  }

  /**
   * Update an active user by ID. Returns the updated user.
   * WITH tx? - Write operation.
   */
  async update(id: number, data: schema.UpdateUser, tx?: Tx) {
    const client = tx ?? this.db;
    const [updated] = await client
      .update(schema.users)
      .set(data)
      .where(and(eq(schema.users.id, id), eq(schema.users.isActive, true)))
      .returning();
    return updated ?? null;
  }
}
