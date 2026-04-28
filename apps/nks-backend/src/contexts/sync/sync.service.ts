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
  PushResponse,
  PushOpResult,
} from './dto';

export type { ChangesResponse, PushResponse };

export interface GetChangesOptions {
  userId: number;
  sessionActiveStoreId: number | null;
  /** Per-table cursors: { state: "ts:id", district: "ts:id" }. Missing tables default to "0:0". */
  cursors: Record<string, string>;
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
 *
 * NOTE: Only include tables that mobile clients have handlers for. Currently only state and district.
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
   *     Invalid ops are immediately assigned a 'rejected' result.
   *   Phase 2: each valid op runs in its OWN transaction so one failure
   *     never rolls back sibling ops (spec §10.4 — batch is not all-or-nothing).
   *
   * Returns per-operation results so mobile can selectively quarantine failed
   * ops without discarding the rest, plus server_time for cursor advancement.
   */
  async processPushBatch(
    operations: SyncOperation[],
    userId: number,
    activeStoreId: number | null,
    offlineSession?: OfflineSessionContext,
  ): Promise<PushResponse> {
    const serverTime = new Date().toISOString();

    if (offlineSession) {
      await this.syncValidation.validateOfflineSession(offlineSession, userId);

      // When offlineToken is absent the JWT write-guard's assertStoreMatch is
      // skipped. Fill the gap: resolve offlineSession.storeGuuid to a numeric ID
      // and verify it matches the session's activeStoreId so a client that holds
      // a valid HMAC for Store A cannot push mutations that land in Store B.
      if (!offlineSession.offlineToken && offlineSession.storeGuuid) {
        const resolvedStoreId = await this.syncRepository.verifyStoreMembership(
          userId,
          offlineSession.storeGuuid,
        );
        SyncAccessValidator.assertStoreMembership(resolvedStoreId);
        SyncAccessValidator.assertPullStoreMatchesSession(resolvedStoreId, activeStoreId);
      }
    }

    const signingKey = offlineSession?.signature ?? null;
    const results: PushOpResult[] = [];

    for (const op of operations) {
      // ── Phase 1: pre-transaction validation ────────────────────────────────
      if (!this.syncValidation.isValidOp(op)) {
        results.push({ opId: op.id, status: 'rejected', reason: 'INVALID_OP' });
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
        results.push({ opId: op.id, status: 'rejected', reason: 'SIGNATURE_MISMATCH' });
        continue;
      }

      // ── Phase 2: each op in its own transaction ─────────────────────────────
      let opResult: PushOpResult;
      try {
        opResult = await this.syncRepository.withTransaction(async (tx) => {
          const idempotencyKey = `${op.clientId}-${op.id}`;
          const requestHash = this.syncValidation.hashOperation(op);

          const claim = await this.syncIdempotency.claim(
            idempotencyKey,
            requestHash,
            tx,
          );

          if (claim === 'replay') {
            return { opId: op.id, status: 'rejected' as const, reason: 'PAYLOAD_TAMPERED' };
          }
          if (claim === 'duplicate') {
            return { opId: op.id, status: 'duplicate' as const };
          }

          const wasHandled = await this.syncHandlerFactory.handle(op, userId, activeStoreId, tx);
          if (!wasHandled) {
            return { opId: op.id, status: 'rejected' as const, reason: 'UNKNOWN_TABLE' };
          }
          return { opId: op.id, status: 'ok' as const };
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'INTERNAL_ERROR';
        this.logger.error(`Op ${op.id} (${op.table}/${op.op}) failed: ${reason}`);
        opResult = { opId: op.id, status: 'error', reason };
      }

      results.push(opResult);
    }

    return { serverTime, results };
  }

  /**
   * Fetch changes since a given compound cursor for pull-based sync.
   *
   * Cursor format: "timestampMs:rowId" — breaks ties when rows share the same updated_at.
   *
   * serverTime is captured before the queries run so mobile uses a consistent
   * clock boundary as its next cursor — not the device clock.
   */
  async getChanges(opts: GetChangesOptions): Promise<ChangesResponse> {
    const {
      userId,
      sessionActiveStoreId,
      cursors,
      storeGuuid,
      tablesCsv,
      limit = DEFAULT_SYNC_LIMIT,
    } = opts;

    // Capture server time before any queries — mobile stores this as its
    // next last_pulled_at cursor. Capturing after would create a window where
    // rows committed between query-end and new Date() get missed on the next pull.
    const serverTime = new Date().toISOString();

    const storeId = await this.syncRepository.verifyStoreMembership(
      userId,
      storeGuuid,
    );
    SyncAccessValidator.assertStoreMembership(storeId);
    SyncAccessValidator.assertPullStoreMatchesSession(storeId, sessionActiveStoreId);

    const requestedTables = tablesCsv
      .split(',')
      .map((t) => t.trim())
      .filter((t) => SUPPORTED_TABLES.has(t));

    this.logger.debug(
      `SYNC: requested tables="${tablesCsv}", supported="${[...SUPPORTED_TABLES].join(',')}",filtered=[${requestedTables.join(',')}]`,
    );

    // Fetch limit+1 rows per table to detect hasMore without a separate COUNT.
    const fetchLimit = limit + 1;

    // Each table uses its own cursor — eliminates re-fetching already-synced tables
    // when one table's cursor is behind (e.g. initial sync of a new table).
    const fetched = await Promise.all(
      requestedTables.map((table) => {
        const { ts, id } = this.parseCursor(cursors[table] ?? '0:0');
        return TABLE_REGISTRY[table as SyncTableKey]
          .fetch(this.syncRepository, ts, id, fetchLimit)
          .then((rows) => ({ table: table as SyncTableKey, rows }));
      }),
    );

    const allChanges: import('./dto/responses').SyncChange[] = [];
    // Per-table next cursors — mobile advances each table independently.
    const nextCursors: Record<string, string> = {};
    let hasMore = false;

    for (const { table, rows } of fetched) {
      this.logger.debug(`SYNC: table="${table}" returned ${rows.length} rows (fetchLimit=${fetchLimit})`);
      if (rows.length > fetchLimit - 1) hasMore = true;
      const slice = rows.slice(0, limit);
      const { map } = TABLE_REGISTRY[table];
      allChanges.push(
        ...slice.map(
          map as (
            r: (typeof rows)[number],
          ) => import('./dto/responses').SyncChange,
        ),
      );
      // Build per-table next cursor from the last row in this table's slice.
      nextCursors[table] = this.buildTableCursor(slice, cursors[table] ?? '0:0');
    }

    this.logger.debug(
      `Changes: ${allChanges.length} row(s) across [${requestedTables.join(',')}], hasMore=${hasMore}`,
    );

    return { serverTime, nextCursors, hasMore, changes: allChanges };
  }

  private parseCursor(cursor: string): { ts: number; id: number } {
    const parts = cursor.split(':');
    if (parts.length !== 2) return { ts: 0, id: 0 };
    const ts = parseInt(parts[0], 10);
    const id = parseInt(parts[1], 10);
    if (isNaN(ts) || isNaN(id)) return { ts: 0, id: 0 };
    return { ts, id };
  }

  /** Build the next cursor for a single table from its result slice. */
  private buildTableCursor(
    rows: Array<{ id: number; updatedAt: Date | null }>,
    fallback: string,
  ): string {
    if (rows.length === 0) return fallback;
    const last = rows[rows.length - 1];
    return `${(last.updatedAt ?? new Date(0)).getTime()}:${last.id}`;
  }
}
