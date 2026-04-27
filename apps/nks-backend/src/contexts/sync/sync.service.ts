import { Injectable, Logger } from '@nestjs/common';
import { SyncRepository } from './repositories/sync.repository';
import { SyncDataMapper } from './mapper/sync-data.mapper';
import { SyncAccessValidator } from './validators/sync-access.validator';
import { SyncHandlerFactory } from './handlers/sync-handler.factory';
import { SyncValidationService } from './services/sync-validation.service';
import { SyncIdempotencyService } from './services/sync-idempotency.service';
import type {
  SyncOperation,
  ChangesResponse,
  OfflineSessionContext,
} from './dto';

export type { ChangesResponse };

export interface GetChangesOptions {
  userId: number;
  cursor: string;
  storeGuuid: string;
  tablesCsv: string;
  limit?: number;
}

const DEFAULT_SYNC_LIMIT = 200;

/**
 * Keys whose values must never appear in logs — tokens, credentials, PII.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'otp',
  'pin',
  'cvv',
  'cardnumber',
]);

function sanitizeOpData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return result;
}

/**
 * Single source of truth for pull-sync tables.
 * Adding a new table: add one entry here — handler, mapper, and SUPPORTED_TABLES stay in sync.
 */
const TABLE_REGISTRY = {
  state: {
    fetch: (
      repo: SyncRepository,
      cursorMs: number,
      cursorId: number,
      limit: number,
    ) => repo.getStateChanges(cursorMs, cursorId, limit),
    map: SyncDataMapper.buildStateChange,
  },
  district: {
    fetch: (
      repo: SyncRepository,
      cursorMs: number,
      cursorId: number,
      limit: number,
    ) => repo.getDistrictChanges(cursorMs, cursorId, limit),
    map: SyncDataMapper.buildDistrictChange,
  },
  routes: {
    fetch: (
      repo: SyncRepository,
      cursorMs: number,
      cursorId: number,
      limit: number,
    ) => repo.getRouteChanges(cursorMs, cursorId, limit),
    map: SyncDataMapper.buildRouteChange,
  },
} as const;

type SyncTableKey = keyof typeof TABLE_REGISTRY;
const SUPPORTED_TABLES = new Set<string>(Object.keys(TABLE_REGISTRY));

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly syncHandlerFactory: SyncHandlerFactory,
    private readonly syncValidation: SyncValidationService,
    private readonly syncIdempotency: SyncIdempotencyService,
  ) {}

  /**
   * Process a batch of sync push operations from the mobile offline sync queue.
   *
   * Two-phase processing:
   *   Phase 1 (pre-transaction): validates every op (type + signature).
   *     Invalid ops are counted as rejected and never touch the DB.
   *   Phase 2 (single atomic transaction): all ops that passed Phase 1 are
   *     executed together. Idempotency duplicates and replays are handled
   *     inside the transaction without causing a rollback.
   */
  async processPushBatch(
    operations: SyncOperation[],
    userId: number,
    activeStoreId: number | null,
    offlineSession?: OfflineSessionContext,
  ): Promise<{
    processed: number;
    rejected: number;
    status: 'ok' | 'partial';
  }> {
    if (offlineSession) {
      await this.syncValidation.validateOfflineSession(offlineSession, userId);
    }

    const signingKey = offlineSession?.signature ?? null;

    // ── Phase 1: validate every op BEFORE opening a transaction ─────────────
    let rejected = 0;
    const validOps: SyncOperation[] = [];

    for (const op of operations) {
      if (!this.syncValidation.isValidOp(op)) {
        rejected++;
        continue;
      }

      if (
        signingKey &&
        !this.syncValidation.verifyOperationSignature(op, signingKey)
      ) {
        this.logger.warn(`Operation ${op.id} rejected — signature mismatch`, {
          table: op.table,
          op: op.op,
          data: sanitizeOpData(op.opData),
        });
        rejected++;
        continue;
      }

      validOps.push(op);
    }

    // ── Phase 2: apply all valid ops in one atomic transaction ───────────────
    let processed = 0;

    if (validOps.length > 0) {
      await this.syncRepository.withTransaction(async (tx) => {
        for (const op of validOps) {
          const idempotencyKey = `${op.clientId}-${op.id}`;
          const requestHash = this.syncValidation.hashOperation(op);

          const result = await this.syncIdempotency.claim(
            idempotencyKey,
            requestHash,
            tx,
          );

          if (result === 'replay') {
            rejected++;
            continue;
          }
          if (result === 'duplicate') continue;

          await this.syncHandlerFactory.handle(op, userId, activeStoreId, tx);
          processed++;
        }
      });
    }

    return { processed, rejected, status: rejected > 0 ? 'partial' : 'ok' };
  }

  /**
   * Fetch changes since a given compound cursor for pull-based sync.
   *
   * Cursor format: "timestampMs:rowId" — breaks ties when rows share the same updated_at.
   */
  async getChanges(opts: GetChangesOptions): Promise<ChangesResponse> {
    const {
      userId,
      cursor,
      storeGuuid,
      tablesCsv,
      limit = DEFAULT_SYNC_LIMIT,
    } = opts;

    const storeId = await this.syncRepository.verifyStoreMembership(
      userId,
      storeGuuid,
    );
    SyncAccessValidator.assertStoreMembership(storeId);

    const { ts: cursorMs, id: cursorId } = this.parseCursor(cursor);

    const requestedTables = tablesCsv
      .split(',')
      .map((t) => t.trim())
      .filter((t) => SUPPORTED_TABLES.has(t));

    // Fetch limit+1 rows per table to detect whether more pages exist
    // without ambiguity.
    const fetchLimit = limit + 1;

    const fetched = await Promise.all(
      requestedTables.map((table) =>
        TABLE_REGISTRY[table as SyncTableKey]
          .fetch(this.syncRepository, cursorMs, cursorId, fetchLimit)
          .then((rows) => ({ table: table as SyncTableKey, rows })),
      ),
    );

    const allChanges: import('./dto/responses').SyncChange[] = [];
    const allRawRows: Array<{ id: number; updatedAt: Date | null }> = [];
    let hasMore = false;

    for (const { table, rows } of fetched) {
      if (rows.length > limit) hasMore = true;
      const slice = rows.slice(0, limit);
      const { map } = TABLE_REGISTRY[table];
      allChanges.push(
        ...slice.map(
          map as (
            r: (typeof rows)[number],
          ) => import('./dto/responses').SyncChange,
        ),
      );
      allRawRows.push(...slice);
    }

    const nextCursor = this.buildNextCursor(allRawRows, cursor);

    this.logger.debug(
      `Changes: ${allChanges.length} row(s) across [${requestedTables.join(',')}], hasMore=${hasMore}, nextCursor=${nextCursor}`,
    );

    return { nextCursor, hasMore, changes: allChanges };
  }

  private parseCursor(cursor: string): { ts: number; id: number } {
    const parts = cursor.split(':');
    if (parts.length !== 2) return { ts: 0, id: 0 };
    const ts = parseInt(parts[0], 10);
    const id = parseInt(parts[1], 10);
    if (isNaN(ts) || isNaN(id)) return { ts: 0, id: 0 };
    return { ts, id };
  }

  private buildNextCursor(
    rows: Array<{ id: number; updatedAt: Date | null }>,
    fallback: string,
  ): string {
    if (rows.length === 0) return fallback;
    const last = rows[rows.length - 1];
    return `${(last.updatedAt ?? new Date(0)).getTime()}:${last.id}`;
  }
}
