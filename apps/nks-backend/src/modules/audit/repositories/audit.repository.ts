import { Injectable } from '@nestjs/common';
import { and, count, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { NewAuditLog } from '../../../core/database/schema/audit-log';
import type { AuditListQuery } from '../dto/requests';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AuditRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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

  async findAll(
    filters: AuditListQuery,
  ): Promise<{ rows: (typeof schema.auditLogs.$inferSelect)[]; total: number }> {
    const conditions: SQL[] = [];

    if (filters.userId !== undefined)
      conditions.push(eq(schema.auditLogs.userFk, filters.userId));
    if (filters.storeId !== undefined)
      conditions.push(eq(schema.auditLogs.storeFk, filters.storeId));
    if (filters.action !== undefined)
      conditions.push(sql`${schema.auditLogs.action} = ${filters.action}::audit_action_type`);
    if (filters.entityType !== undefined)
      conditions.push(eq(schema.auditLogs.entityType, filters.entityType));
    if (filters.isSuccess !== undefined)
      conditions.push(eq(schema.auditLogs.isSuccess, filters.isSuccess));
    if (filters.fromDate !== undefined)
      conditions.push(gte(schema.auditLogs.createdAt, filters.fromDate));
    if (filters.toDate !== undefined)
      conditions.push(lte(schema.auditLogs.createdAt, filters.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.auditLogs)
        .where(where)
        .limit(filters.limit)
        .offset(filters.offset)
        .orderBy(schema.auditLogs.createdAt),
      this.db
        .select({ total: count() })
        .from(schema.auditLogs)
        .where(where),
    ]);

    return { rows, total };
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
