import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count } from 'drizzle-orm';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { status } from '../../../../core/database/schema/entity-system/status/status.table';
import type { NewStatus, UpdateStatus } from '../../../../core/database/schema/entity-system/status/status.table';

type Status = typeof status.$inferSelect;

@Injectable()
export class StatusRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  async findPage(opts: {
    page:     number;
    pageSize: number;
    search?:  string;
  }): Promise<{ rows: Status[]; total: number }> {
    const { page, pageSize, search } = opts;
    const offset = StatusRepository.toOffset(page, pageSize);

    const where = and(
      isNull(status.deletedAt),
      ilikeAny(search, status.name, status.code),
    );

    return this.paginate(
      this.db.select().from(status).where(where).orderBy(status.sortOrder, status.code).limit(pageSize).offset(offset),
      () => this.db.select({ total: count() }).from(status).where(where),
      page, pageSize,
    );
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
        and(eq(status.guuid, guuid), eq(status.isActive, true), isNull(status.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByCode(code: string): Promise<Status | null> {
    const [row] = await this.db
      .select()
      .from(status)
      .where(
        and(eq(status.code, code), eq(status.isActive, true), isNull(status.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: NewStatus, createdBy: number): Promise<Status> {
    return this.insertOneAudited(status, data, createdBy);
  }

  async update(id: number, data: UpdateStatus, modifiedBy: number): Promise<Status | null> {
    return this.updateOneAudited(
      status,
      data,
      and(eq(status.id, id), isNull(status.deletedAt))!,
      modifiedBy,
    );
  }

  async softDelete(id: number, deletedBy: number): Promise<Status | null> {
    return this.softDeleteAudited(status, eq(status.id, id), deletedBy);
  }
}
