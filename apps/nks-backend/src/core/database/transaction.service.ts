import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { InjectDb } from './inject-db.decorator';

export type DbTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

export interface TransactionOptions {
  timeout?: number;
  name?: string;
}

/**
 * TransactionService — the ONLY place in the application that calls
 * `db.transaction()`.
 *
 * Services inject this instead of the raw database token, keeping
 * the DB concern contained within the database layer.
 *
 * All operations are ATOMIC — either all succeed or all roll back.
 * No partial state possible.
 *
 * ✅ Features:
 * - Drizzle auto-rollback on error
 * - Structured logging with transaction names
 * - Timing metrics for monitoring
 *
 * @example
 * constructor(private readonly txService: TransactionService) {}
 *
 * const result = await this.txService.run(
 *   async (tx) => {
 *     await this.companyRepo.create(data, tx);
 *     await this.companyRepo.addUserToCompany(mapping, tx);
 *     return { success: true };
 *   },
 *   { name: 'CreateCompanyWithUser', timeout: 5000 }
 * );
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Execute `fn` inside a single database transaction.
   * Rolls back automatically on any thrown error via Drizzle.
   * Returns the result of the callback directly.
   *
   * ✅ ATOMIC: All statements succeed or all roll back
   * ✅ LOGGED: Structured logging with timing information
   * ✅ TYPED: Full TypeScript support for callback return type
   *
   * @param fn - Callback function receiving transaction instance
   * @param options - Transaction options (name for logging)
   * @returns Result from callback
   *
   * @example
   * const user = await txService.run(
   *   async (tx) => {
   *     const created = await db.insert(schema.users).values(...).returning();
   *     await db.insert(schema.sessions).values(...);
   *     return created[0];
   *   },
   *   { name: 'CreateUserWithSession' }
   * );
   */
  async run<T>(
    fn: (tx: DbTransaction) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const { name = 'UnnamedTransaction' } = options;
    const startTime = Date.now();

    try {
      this.logger.debug(`Transaction started`, {
        name,
      });

      // Drizzle's db.transaction() handles rollback automatically on error.
      // When timeout is set, apply it as a session-local limit so runaway
      // transactions fail fast rather than holding locks indefinitely.
      const { timeout } = options;
      const result = await this.db.transaction(async (tx) => {
        if (timeout !== undefined) {
          // PostgreSQL SET LOCAL does not support $1 parameters — interpolation is
          // unavoidable. Guard with isSafeInteger (rejects NaN, Infinity, floats,
          // strings) + an upper bound so only a plain positive ms value reaches SQL.
          if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 3_600_000) {
            throw new Error(`Invalid transaction timeout: ${String(timeout)}`);
          }
          await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${timeout}`));
        }
        return fn(tx);
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Transaction committed`, {
        name,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      // Drizzle auto-rolled back, just log it
      this.logger.error(`Transaction failed and was rolled back`, {
        name,
        duration,
        error: err.message,
      });

      throw err; // Re-throw for caller to handle
    }
  }
}
