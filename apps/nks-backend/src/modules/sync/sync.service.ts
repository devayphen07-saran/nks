import { Injectable, Logger } from '@nestjs/common';
import * as jose from 'jose';
import { SyncRepository } from './sync.repository';

interface SyncOperation {
  id: string;
  clientId: string;
  table: string;
  op: string;
  opData: Record<string, any>;
}

const VALID_OPS = new Set(['PUT', 'PATCH', 'DELETE']);

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly syncRepository: SyncRepository) {}

  /**
   * Process a batch of sync push operations from PowerSync.
   *
   * Each operation is wrapped in a transaction with its idempotency
   * log entry so a crash between the mutation and the log write
   * never causes re-processing on retry.
   */
  async processPushBatch(
    operations: SyncOperation[],
    userId: number,
    activeStoreId: number | null,
  ): Promise<{ processed: number }> {
    let processed = 0;

    for (const op of operations) {
      if (!VALID_OPS.has(op.op)) {
        this.logger.warn(`Unknown op "${op.op}" for ${op.id} — skipped`);
        continue;
      }

      const idempotencyKey = `${op.clientId}-${op.id}`;

      await this.syncRepository.withTransaction(async (tx) => {
        const alreadySeen = await this.syncRepository.isAlreadyProcessed(
          idempotencyKey,
          tx,
        );

        if (alreadySeen) {
          this.logger.log(`Duplicate skipped: ${idempotencyKey}`);
          return;
        }

        await this.processOperation(op, userId, activeStoreId, tx);

        await this.syncRepository.logIdempotencyKey(idempotencyKey, tx);
      });

      processed++;
    }

    return { processed };
  }

  /**
   * Route a single sync operation to the correct domain handler.
   *
   * Domain-specific table handlers will be added here when syncable
   * tables (delivery routes, locations, etc.) are created.
   */
  private async processOperation(
    op: SyncOperation,
    _userId: number,
    _activeStoreId: number | null,
    _tx: any,
  ): Promise<void> {
    // Future: switch on op.table to route to domain handlers
    // case 'delivery_routes': ...
    // case 'locations': ...

    this.logger.warn(
      `Sync push for unhandled table "${op.table}" — op ${op.op} ${op.id} logged but not applied`,
    );
  }

  /**
   * Generate a short-lived JWT for PowerSync service authentication.
   *
   * PowerSync requires its own JWT with a specific audience matching
   * the PowerSync instance URL. Separate from NKS access/offline tokens.
   */
  async generatePowerSyncToken(
    userGuuid: string,
    email: string,
  ): Promise<{ token: string; expiresAt: number }> {
    const privateKeyPem = process.env['POWERSYNC_PRIVATE_KEY'];
    if (!privateKeyPem) {
      throw new Error('POWERSYNC_PRIVATE_KEY environment variable is not set');
    }

    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

    const token = await new jose.SignJWT({ email })
      .setProtectedHeader({ alg: 'RS256', kid: 'powersync-key-1' })
      .setSubject(userGuuid)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience(process.env['POWERSYNC_URL'] ?? '')
      .sign(privateKey);

    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.logger.log(`PowerSync token issued for user ${userGuuid}`);

    return { token, expiresAt };
  }

  /**
   * Field-level merge using per-field timestamps.
   *
   * For each field: the value whose {field}_updated_at timestamp
   * is newer wins. Prevents loss when two users edited different
   * fields of the same record while both were offline.
   */
  static fieldLevelMerge(
    server: Record<string, any>,
    client: Record<string, any>,
  ): Record<string, any> {
    const IMMUTABLE = new Set([
      'id', 'storeId', 'store_id',
      'createdAt', 'created_at',
      'version', 'deletedAt', 'deleted_at',
    ]);
    const merged = { ...server };

    for (const [key, clientValue] of Object.entries(client)) {
      if (IMMUTABLE.has(key) || key.endsWith('_updatedAt') || key.endsWith('_updated_at')) {
        continue;
      }

      const clientTs = client[`${key}_updatedAt`] ?? client[`${key}_updated_at`];
      const serverTs = server[`${key}_updatedAt`] ?? server[`${key}_updated_at`];

      if (serverTs && clientTs) {
        if (new Date(clientTs) > new Date(serverTs)) {
          merged[key] = clientValue;
          const tsKey = `${key}_updatedAt` in server ? `${key}_updatedAt` : `${key}_updated_at`;
          merged[tsKey] = clientTs;
        }
      } else if (!serverTs && clientTs) {
        merged[key] = clientValue;
        const tsKey = `${key}_updatedAt` in client ? `${key}_updatedAt` : `${key}_updated_at`;
        merged[tsKey] = clientTs;
      }
    }

    return merged;
  }
}
