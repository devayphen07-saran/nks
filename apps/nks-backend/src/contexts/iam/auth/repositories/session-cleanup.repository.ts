import { Injectable } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class SessionCleanupRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async deleteExpiredSessions(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(lt(schema.userSession.expiresAt, cutoffDate));

    return result.rowCount ?? 0;
  }
}
