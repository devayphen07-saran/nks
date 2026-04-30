import { Injectable, Logger } from '@nestjs/common';
import { SyncRepository } from './repositories/sync.repository';
import { SyncAccessValidator } from './validators/sync-access.validator';
import { SyncHandlerFactory } from './handlers/sync-handler.factory';
import { SyncSignatureService } from './services/sync-signature.service';
import { SyncIdempotencyService } from './services/sync-idempotency.service';
import { parseCursor } from './sync-cursor';
import type {
  SyncOperation,
  SyncChange,
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

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly syncHandlerFactory: SyncHandlerFactory,
    private readonly syncSignature: SyncSignatureService,
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
      await this.syncSignature.validateOfflineSession(offlineSession, userId);

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
      // Op type ('create'|'update'|'delete') validated by Zod enum on the DTO.
      if (
        signingKey &&
        !this.syncSignature.verifyOperationSignature(op, signingKey)
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
          const requestHash = this.syncSignature.hashOperation(op);

          const claim = await this.syncIdempotency.claim(
            idempotencyKey,
            requestHash,
            tx,
          );

          if (claim === 'replay') {
            return { opId: op.id, status: 'rejected' as const, reason: 'IDEMPOTENCY_REPLAY' };
          }
          if (claim === 'duplicate') {
            return { opId: op.id, status: 'duplicate' as const };
          }

          const handlerResult = await this.syncHandlerFactory.handle(op, userId, activeStoreId, tx);
          if (handlerResult === null) {
            return { opId: op.id, status: 'rejected' as const, reason: 'UNKNOWN_TABLE' };
          }
          if (handlerResult.status === 'rejected') {
            return { opId: op.id, status: 'rejected' as const, reason: handlerResult.reason };
          }
          if (handlerResult.status === 'conflict') {
            // The base class read with FOR UPDATE before detecting the version
            // mismatch and DID NOT write — the transaction commits the
            // idempotency claim only, not any data change. Mobile receives
            // serverState and is expected to merge or re-queue.
            return {
              opId: op.id,
              status: 'conflict' as const,
              serverState: handlerResult.serverState,
            };
          }
          return {
            opId: op.id,
            status: 'ok' as const,
            serverState: handlerResult.serverState,
          };
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

    // Filter requested tables to those with a registered handler. Pull and
    // push share the same handler registry — adding a new sync table now
    // means writing one handler and registering it; no edits here.
    const known = this.syncHandlerFactory.knownTables();
    const requestedTables = tablesCsv
      .split(',')
      .map((t) => t.trim())
      .filter((t) => known.has(t));

    this.logger.debug(
      `SYNC: requested tables="${tablesCsv}", known="${[...known].join(',')}", filtered=[${requestedTables.join(',')}]`,
    );

    const batches = await Promise.all(
      requestedTables.map(async (table) => {
        const cursorStr = cursors[table] ?? '0:0';
        const { ts, id } = parseCursor(cursorStr);
        const handler = this.syncHandlerFactory.get(table);
        // Filter above guarantees handler exists; defensive fallback:
        if (!handler) {
          return { table, batch: { changes: [] as SyncChange[], nextCursor: cursorStr, hasMore: false } };
        }
        const batch = await handler.getChanges(ts, id, limit);
        return { table, batch };
      }),
    );

    const allChanges: SyncChange[] = [];
    const nextCursors: Record<string, string> = {};
    let hasMore = false;

    for (const { table, batch } of batches) {
      allChanges.push(...batch.changes);
      nextCursors[table] = batch.nextCursor;
      if (batch.hasMore) hasMore = true;
    }

    this.logger.debug(
      `Changes: ${allChanges.length} row(s) across [${requestedTables.join(',')}], hasMore=${hasMore}`,
    );

    return { serverTime, nextCursors, hasMore, changes: allChanges };
  }
}
