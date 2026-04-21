import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { NewAuditLog } from '../../../../core/database/schema/audit-log';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuditRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async create(data: Omit<NewAuditLog, 'createdAt' | 'id' | 'guuid'>): Promise<void> {
    await this.db.insert(schema.auditLogs).values({
      ...data,
      createdAt: new Date(),
    });
  }

  async findByUserId(
    userId: number,
    limit: number = 100,
  ): Promise<(typeof schema.auditLogs.$inferSelect)[]> {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.userFk, userId))
      .limit(limit);
  }

  async findPage(opts: {
    page:        number;
    pageSize:    number;
    userId?:     number;
    storeId?:    number;
    action?:     string;
    entityType?: string;
    isSuccess?:  boolean;
    fromDate?:   Date;
    toDate?:     Date;
  }): Promise<{ rows: (typeof schema.auditLogs.$inferSelect)[]; total: number }> {
    const { page, pageSize } = opts;
    const offset = (page - 1) * pageSize;
    const conditions: SQL[] = [];

    if (opts.userId !== undefined)
      conditions.push(eq(schema.auditLogs.userFk, opts.userId));
    if (opts.storeId !== undefined)
      conditions.push(eq(schema.auditLogs.storeFk, opts.storeId));
    if (opts.action !== undefined)
      conditions.push(sql`${schema.auditLogs.action} = ${opts.action}::audit_action_type`);
    if (opts.entityType !== undefined)
      conditions.push(eq(schema.auditLogs.entityType, opts.entityType));
    if (opts.isSuccess !== undefined)
      conditions.push(eq(schema.auditLogs.isSuccess, opts.isSuccess));
    if (opts.fromDate !== undefined)
      conditions.push(gte(schema.auditLogs.createdAt, opts.fromDate));
    if (opts.toDate !== undefined)
      conditions.push(lte(schema.auditLogs.createdAt, opts.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return this.paginate(
      this.db.select().from(schema.auditLogs).where(where).orderBy(desc(schema.auditLogs.createdAt)).limit(pageSize).offset(offset),
      this.db.select({ total: count() }).from(schema.auditLogs).where(where),
    );
  }

  async findById(id: number): Promise<(typeof schema.auditLogs.$inferSelect) | null> {
    const [row] = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, id))
      .limit(1);

    return row ?? null;
  }
}
