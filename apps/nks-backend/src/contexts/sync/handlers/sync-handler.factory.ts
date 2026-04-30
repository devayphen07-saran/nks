import { Injectable, Logger } from '@nestjs/common';
import type { DbTransaction } from '../../../core/database/transaction.service';
import type { SyncHandler, SyncHandlerResult } from './sync-handler.interface';
import type { SyncOperation } from '../dto';

/**
 * SyncHandlerFactory
 *
 * Central registry for domain sync handlers. Add a new handler by calling
 * register() in the relevant domain module or in SyncModule.
 *
 * Design:
 * - One handler per table name (matches the `table` field in SyncOperation)
 * - Unknown tables return `null` — caller maps to UNKNOWN_TABLE rejection
 * - register() is idempotent: registering a second time overwrites the first
 */
@Injectable()
export class SyncHandlerFactory {
  private readonly logger = new Logger(SyncHandlerFactory.name);
  private readonly handlers = new Map<string, SyncHandler>();

  /** Register a handler for a table name. Called during module initialization. */
  register(table: string, handler: SyncHandler): void {
    this.handlers.set(table, handler);
    this.logger.debug(`Handler registered for sync table "${table}"`);
  }

  /**
   * Look up the handler for a table. Used by both pull (`getChanges`) and
   * push (`handle`) paths so the same registry drives both directions.
   */
  get(table: string): SyncHandler | undefined {
    return this.handlers.get(table);
  }

  /** Tables with a registered handler — used to filter the pull `tables` query param. */
  knownTables(): Set<string> {
    return new Set(this.handlers.keys());
  }

  /**
   * Route a single sync operation to its registered handler.
   * Returns the handler's result, or `null` if no handler is registered
   * for the table (caller maps that to `UNKNOWN_TABLE`).
   */
  async handle(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: DbTransaction,
  ): Promise<SyncHandlerResult | null> {
    const handler = this.handlers.get(op.table);

    if (!handler) {
      this.logger.warn(
        `No handler registered for sync table "${op.table}" — operation ${op.id} skipped`,
      );
      return null;
    }

    return handler.handle(op, userId, activeStoreId, tx);
  }
}
