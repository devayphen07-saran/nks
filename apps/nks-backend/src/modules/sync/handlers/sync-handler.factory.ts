import { Injectable, Logger } from '@nestjs/common';
import type { SyncHandler } from './sync-handler.interface';
import type { SyncOperation } from '../dto';

/**
 * SyncHandlerFactory
 *
 * Central registry for domain sync handlers. Add a new handler by calling
 * register() in the relevant domain module or in SyncModule.
 *
 * Design:
 * - One handler per table name (matches the `table` field in SyncOperation)
 * - Unknown tables are logged and skipped — safe to deploy before the handler exists
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
   * Route a single sync operation to its registered handler.
   * Returns true if a handler was found and executed, false if the table
   * has no handler (operation is safely skipped with a warning).
   */
  async handle(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: unknown,
  ): Promise<boolean> {
    const handler = this.handlers.get(op.table);

    if (!handler) {
      this.logger.warn(
        `No handler registered for sync table "${op.table}" — operation ${op.id} skipped`,
      );
      return false;
    }

    await handler.handle(op, userId, activeStoreId, tx);
    return true;
  }
}
