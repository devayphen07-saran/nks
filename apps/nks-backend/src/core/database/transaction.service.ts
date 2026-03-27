import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { InjectDb } from './inject-db.decorator';

export type DbTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

/**
 * TransactionService — the ONLY place in the application that calls
 * `db.transaction()`.
 *
 * Services inject this instead of the raw database token, keeping
 * the DB concern contained within the database layer.
 *
 * @example
 * constructor(private readonly txService: TransactionService) {}
 *
 * await this.txService.run(async (tx) => {
 *   await this.companyRepo.create(data, tx);
 *   await this.companyRepo.addUserToCompany(mapping, tx);
 * });
 */
@Injectable()
export class TransactionService {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Execute `fn` inside a single database transaction.
   * Rolls back automatically on any thrown error.
   */
  run<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }
}
