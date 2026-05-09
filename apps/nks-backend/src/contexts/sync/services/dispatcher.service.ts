import { Injectable, Logger } from '@nestjs/common';
import type { SyncHandler } from '../handlers/sync-handler.interface';

/**
 * DispatcherService is the registry for sync handlers.
 *
 * Domain modules register their handlers during onModuleInit:
 *
 *   constructor(private dispatcher: DispatcherService, private productsSync: ProductsSyncService) {}
 *   onModuleInit() {
 *     this.dispatcher.register('product', this.productsSync);
 *   }
 *
 * SyncService.applyOperation and SyncService.pullEntity look up handlers
 * by entity type and dispatch to the appropriate handler.
 *
 * IMPORTANT: getHandler returns undefined for unknown entities (doesn't throw).
 * The caller decides whether to return error or retry. This allows graceful
 * handling of new entity types deployed without restarting sync.
 */
@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);
  private readonly handlers = new Map<string, SyncHandler>();

  /**
   * Register a sync handler for an entity type.
   *
   * Called by domain modules during onModuleInit.
   * Safe to call multiple times; later registrations override earlier ones.
   *
   * @param entity - Entity type (must match what mobile sends, e.g. 'product')
   * @param handler - Instance of a handler extending BaseSyncHandler
   */
  register(entity: string, handler: SyncHandler): void {
    this.handlers.set(entity, handler);
  }

  /**
   * Get a handler by entity type.
   *
   * @param entity - Entity type to look up
   * @returns Handler instance or undefined (does not throw)
   */
  getHandler(entity: string): SyncHandler | undefined {
    return this.handlers.get(entity);
  }
}
