import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { NewAuditLog } from '../../../../core/database/schema/audit-log';
import type { AuditLogRow } from '../dto/responses/audit-log.response.dto';

type Db = NodePgDatabase<typeof schema>;

// ─── Shared select projection ─────────────────────────────────────────────────

const auditLogSelect = {
  id: schema.auditLogs.id,
  guuid: schema.auditLogs.guuid,
  userGuuid: schema.users.guuid,
  userIamUserId: schema.users.iamUserId,
  storeGuuid: schema.store.guuid,
  sessionGuuid: schema.userSession.guuid,
  action: schema.auditLogs.action,
  entityType: schema.auditLogs.entityType,
  meta: schema.auditLogs.meta,
  ipAddress: schema.auditLogs.ipAddress,
  userAgent: schema.auditLogs.userAgent,
  deviceId: schema.auditLogs.deviceId,
  deviceType: schema.auditLogs.deviceType,
  isSuccess: schema.auditLogs.isSuccess,
  failureReason: schema.auditLogs.failureReason,
  createdAt: schema.auditLogs.createdAt,
};

@Injectable()
export class AuditRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  private withJoins() {
    return this.db
      .select(auditLogSelect)
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userFk, schema.users.id))
      .leftJoin(schema.store, eq(schema.auditLogs.storeFk, schema.store.id))
      .leftJoin(
        schema.userSession,
        eq(schema.auditLogs.sessionFk, schema.userSession.id),
      );
  }

  async create(
    data: Omit<NewAuditLog, 'createdAt' | 'id' | 'guuid'>,
  ): Promise<void> {
    await this.db.insert(schema.auditLogs).values({
      ...data,
      createdAt: new Date(),
    });
  }

  async findByUserId(userId: number, limit = 100): Promise<AuditLogRow[]> {
    const rows = await this.withJoins()
      .where(eq(schema.auditLogs.userFk, userId))
      .limit(limit);
    return rows.map(this.toAuditLogRow);
  }

  async findPage(opts: {
    page: number;
    pageSize: number;
    userGuuid?: string;
    storeGuuid?: string;
    action?: string;
    entityType?: string;
    isSuccess?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ rows: AuditLogRow[]; total: number }> {
    const { page, pageSize } = opts;
    const offset = AuditRepository.toOffset(page, pageSize);
    const conditions: SQL[] = [];

    if (opts.userGuuid !== undefined)
      conditions.push(eq(schema.users.guuid, opts.userGuuid));
    if (opts.storeGuuid !== undefined)
      conditions.push(eq(schema.store.guuid, opts.storeGuuid));
    if (opts.action !== undefined)
      conditions.push(
        sql`${schema.auditLogs.action} = ${opts.action}::audit_action_type`,
      );
    if (opts.entityType !== undefined)
      conditions.push(eq(schema.auditLogs.entityType, opts.entityType));
    if (opts.isSuccess !== undefined)
      conditions.push(eq(schema.auditLogs.isSuccess, opts.isSuccess));
    if (opts.fromDate !== undefined)
      conditions.push(gte(schema.auditLogs.createdAt, opts.fromDate));
    if (opts.toDate !== undefined)
      conditions.push(lte(schema.auditLogs.createdAt, opts.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const { rows, total } = await this.paginate(
      this.withJoins()
        .where(where)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(schema.auditLogs).where(where),
      page, pageSize,
    );
    return { rows: rows.map(this.toAuditLogRow), total };
  }

  async findById(id: number): Promise<AuditLogRow | null> {
    const [row] = await this.withJoins()
      .where(eq(schema.auditLogs.id, id))
      .limit(1);
    return row ? this.toAuditLogRow(row) : null;
  }

  async findByGuuid(guuid: string): Promise<AuditLogRow | null> {
    const [row] = await this.withJoins()
      .where(eq(schema.auditLogs.guuid, guuid))
      .limit(1);
    return row ? this.toAuditLogRow(row) : null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Maps the Drizzle JOIN result to AuditLogRow.
   * Enum columns (action, deviceType) widen to string safely — no cast needed.
   */
  private toAuditLogRow(
    raw: Awaited<ReturnType<AuditRepository['withJoins']>>[0],
  ): AuditLogRow {
    return {
      id: raw.id,
      guuid: raw.guuid,
      userGuuid: raw.userGuuid,
      userIamUserId: raw.userIamUserId,
      storeGuuid: raw.storeGuuid,
      sessionGuuid: raw.sessionGuuid,
      action: raw.action,
      entityType: raw.entityType,
      meta: raw.meta,
      ipAddress: raw.ipAddress,
      userAgent: raw.userAgent,
      deviceId: raw.deviceId,
      deviceType: raw.deviceType,
      isSuccess: raw.isSuccess,
      failureReason: raw.failureReason,
      createdAt: raw.createdAt,
    };
  }
}
