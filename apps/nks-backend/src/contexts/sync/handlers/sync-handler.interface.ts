import type { SyncOperation } from '../dto';

/**
 * Interface every domain sync handler must implement.
 * Register implementations in SyncHandlerFactory.
 */
export interface SyncHandler {
  handle(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: unknown,
  ): Promise<void>;
}
