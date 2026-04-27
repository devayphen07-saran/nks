import { Injectable, Logger } from '@nestjs/common';
import { SyncRepository } from '../repositories/sync.repository';

export type IdempotencyResult = 'processed' | 'duplicate' | 'replay';

// Extract the transaction type from the repository so we don't need to re-import
// NodePgDatabase<typeof schema> here — the repository owns that detail.
type SyncTx = Parameters<SyncRepository['claimIdempotencyKey']>[2];

@Injectable()
export class SyncIdempotencyService {
  private readonly logger = new Logger(SyncIdempotencyService.name);

  constructor(private readonly syncRepository: SyncRepository) {}

  /**
   * Atomically claims an idempotency key and returns the outcome:
   *
   *   'processed' — key was newly claimed; caller should execute the operation.
   *   'duplicate' — key already committed with the same hash; safe to skip.
   *   'replay'    — key already committed with a DIFFERENT hash; tampered payload.
   *
   * Must be called inside an open transaction so the claim and the operation
   * execute atomically. If the operation throws, the transaction rolls back,
   * releasing the claim so the client can retry with the same key.
   */
  async claim(
    idempotencyKey: string,
    requestHash: string,
    tx: SyncTx,
  ): Promise<IdempotencyResult> {
    const claimed = await this.syncRepository.claimIdempotencyKey(
      idempotencyKey,
      requestHash,
      tx,
    );

    if (claimed) return 'processed';

    const storedHash = await this.syncRepository.getStoredHash(idempotencyKey, tx);
    if (storedHash !== requestHash) {
      this.logger.warn(
        `Idempotency key ${idempotencyKey} reused with different payload — replay rejected`,
      );
      return 'replay';
    }

    this.logger.log(`Duplicate skipped: ${idempotencyKey}`);
    return 'duplicate';
  }
}
