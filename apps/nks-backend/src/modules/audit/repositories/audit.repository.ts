import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { NewAuditLog } from '../../../core/database/schema/audit-log';

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
}
