import { Injectable } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class SessionCleanupRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async deleteExpiredSessions(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(lt(schema.userSession.expiresAt, cutoffDate));

    return result.rowCount ?? 0;
  }
}
