import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { status } from '../../../core/database/schema/entity-system/status/status.table';
import type { NewStatus, UpdateStatus } from '../../../core/database/schema/entity-system/status/status.table';

type Status = typeof status.$inferSelect;

@Injectable()
export class StatusRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll(search?: string): Promise<Status[]> {
    const where = and(
      isNull(status.deletedAt),
      search?.trim()
        ? or(
            ilike(status.name, `%${search}%`),
            ilike(status.code, `%${search}%`),
          )
        : undefined,
    );

    return this.db
      .select()
      .from(status)
      .where(where)
      .orderBy(status.sortOrder, status.code);
  }

  async findActive(): Promise<Status[]> {
    return this.db
      .select()
      .from(status)
      .where(
        and(
          eq(status.isActive, true),
          isNull(status.deletedAt),
        ),
      )
      .orderBy(status.sortOrder, status.code);
  }

  async findByGuuid(guuid: string): Promise<Status | null> {
    const [row] = await this.db
      .select()
      .from(status)
      .where(
        and(eq(status.guuid, guuid), isNull(status.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByCode(code: string): Promise<Status | null> {
    const [row] = await this.db
      .select()
      .from(status)
      .where(
        and(eq(status.code, code), isNull(status.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: NewStatus): Promise<Status> {
    const [row] = await this.db
      .insert(status)
      .values(data)
      .returning();
    return row;
  }

  async update(id: number, data: UpdateStatus): Promise<Status | null> {
    const [row] = await this.db
      .update(status)
      .set(data)
      .where(and(eq(status.id, id), isNull(status.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDelete(id: number, deletedBy: number): Promise<Status | null> {
    const [row] = await this.db
      .update(status)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(status.id, id))
      .returning();
    return row ?? null;
  }
}
