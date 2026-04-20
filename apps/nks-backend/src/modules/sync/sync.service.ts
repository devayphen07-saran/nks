import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { verifyOfflineSession } from '../../common/utils/offline-session-hmac';
import { SyncRepository } from './repositories/sync.repository';
import { SyncDataMapper } from './mappers/sync-data.mapper';
import { SyncDataValidator } from './validators/sync-data.validator';
import { RevokedDevicesRepository } from '../auth/repositories/revoked-devices.repository';
import { JWTConfigService } from '../../config/jwt.config';
import { SyncHandlerFactory } from './handlers/sync-handler.factory';
import type {
  SyncOperation,
  ChangesResponse,
  OfflineSessionContext,
} from './dto';

export type { ChangesResponse };

const DEFAULT_SYNC_LIMIT = 200;

/** Keys whose values must never appear in logs — tokens, credentials, PII. */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'otp',
  'pin',
  'cvv',
  'cardNumber',
]);

/**
 * Returns a copy of opData with values of known sensitive keys replaced by '[REDACTED]'.
 * Use this whenever opData needs to appear in a log message.
 */
function sanitizeOpData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return result;
}

/** Tables supported for pull sync. Mobile sends a subset via the `tables` query param. */
const SUPPORTED_TABLES = new Set(['state', 'district', 'routes']);

/**
 * Deterministic JSON serialisation with sorted keys.
 *
 * Ensures the same logical object produces the identical string on any JS engine
 * (Hermes on mobile, V8 on server). Standard JSON.stringify does not guarantee
 * key order — {a:1,b:2} and {b:2,a:1} can serialise differently, causing
 * signature mismatches on legitimate operations.
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number')
    return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`,
  );
  return '{' + entries.join(',') + '}';
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly configService: ConfigService,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
    private readonly jwtConfigService: JWTConfigService,
    private readonly syncHandlerFactory: SyncHandlerFactory,
  ) {}

  /**
   * Process a batch of sync push operations from the mobile offline sync queue.
   *
   * Two-phase processing:
   *
   * **Phase 1 (pre-transaction):** Validates every op (op type, signature).
   * Invalid ops are counted as `rejected` and never touch the DB.
   *
   * **Phase 2 (single atomic transaction):** All ops that passed Phase 1 are
   * executed in one transaction. If any applied op throws, the entire batch
   * rolls back (all-or-nothing for the applied set). Idempotency duplicates
   * and hash mismatches are skipped/rejected within the transaction without
   * causing a rollback.
   *
   * Response contract:
   * - `processed`: ops successfully applied in this transaction
   * - `rejected`: ops that failed validation (Phase 1) or idempotency mismatch (Phase 2)
   * - `status`: 'ok' if rejected === 0, 'partial' otherwise
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
      await this.validateOfflineSessionSignature(offlineSession);
    }

    const signingKey = offlineSession?.signature ?? null;

    // ── Phase 1: validate every op BEFORE opening a transaction ─────────────
    // Rejected ops never touch the DB; valid ops are queued for the batch.
    let rejected = 0;
    const validOps: SyncOperation[] = [];

    for (const op of operations) {
      if (!SyncDataValidator.isValidOp(op.op)) {
        this.logger.warn(`Unknown op "${op.op}" for ${op.id} — rejected`);
        rejected++;
        continue;
      }

      if (signingKey) {
        if (!this.verifyOperationSignature(op, signingKey)) {
          this.logger.warn(`Operation ${op.id} rejected — signature mismatch`, {
            table: op.table,
            op: op.op,
            data: sanitizeOpData(op.opData),
          });
          rejected++;
          continue;
        }
      }

      validOps.push(op);
    }

    // ── Phase 2: apply all valid ops in one atomic transaction ───────────────
    let processed = 0;

    if (validOps.length > 0) {
      await this.syncRepository.withTransaction(async (tx) => {
        for (const op of validOps) {
          const idempotencyKey = `${op.clientId}-${op.id}`;
          const requestHash = this.hashOperation(op);

          const existingHash = await this.syncRepository.findProcessedEntry(
            idempotencyKey,
            tx,
          );

          if (existingHash !== null) {
            if (existingHash !== requestHash) {
              this.logger.warn(
                `Idempotency key ${idempotencyKey} reused with different payload — rejected`,
              );
              rejected++;
            } else {
              this.logger.log(`Duplicate skipped: ${idempotencyKey}`);
            }
            continue;
          }

          await this.processOperation(op, userId, activeStoreId, tx);
          await this.syncRepository.logIdempotencyKey(
            idempotencyKey,
            requestHash,
            tx,
          );
          processed++;
        }
      });
    }

    const status = rejected > 0 ? 'partial' : 'ok';
    return { processed, rejected, status };
  }

  /**
   * Parse a compound cursor string "timestampMs:rowId" into its components.
   * Returns { ts: 0, id: 0 } for the initial cursor "0:0" or invalid input.
   */
  private parseCursor(cursor: string): { ts: number; id: number } {
    const parts = cursor.split(':');
    if (parts.length !== 2) return { ts: 0, id: 0 };
    const ts = parseInt(parts[0], 10);
    const id = parseInt(parts[1], 10);
    if (isNaN(ts) || isNaN(id)) return { ts: 0, id: 0 };
    return { ts, id };
  }

  /**
   * Build a compound cursor string from the last row in a change set.
   * Uses (updatedAt, id) to guarantee every row is delivered exactly once
   * even when multiple rows share the same updated_at timestamp.
   */
  private buildNextCursor(
    changes: import('./dto/responses').SyncChange[],
    fallback: string,
  ): string {
    if (changes.length === 0) return fallback;
    const last = changes[changes.length - 1];
    return `${last.updatedAt}:${last.id}`;
  }

  /**
   * Fetch changes since a given compound cursor for pull-based sync.
   *
   * Validates store membership, then fetches all requested tables since the cursor.
   * Each table is fetched independently so mobile can advance per-table cursors.
   * Cursor format: "timestampMs:rowId" — breaks ties when rows share the same updated_at.
   */
  async getChanges(
    userId: number,
    cursor: string,
    storeGuuid: string,
    tablesCsv: string,
    limit: number = DEFAULT_SYNC_LIMIT,
  ): Promise<ChangesResponse> {
    const storeId = await this.syncRepository.verifyStoreMembership(
      userId,
      storeGuuid,
    );

    if (!storeId) {
      throw new ForbiddenException(
        'You do not have access to this store or it does not exist.',
      );
    }

    const { ts: cursorMs, id: cursorId } = this.parseCursor(cursor);

    const requestedTables = tablesCsv
      .split(',')
      .map((t) => t.trim())
      .filter((t) => SUPPORTED_TABLES.has(t));

    const allChanges: import('./dto/responses').SyncChange[] = [];

    for (const table of requestedTables) {
      if (table === 'state') {
        const rows = await this.syncRepository.getStateChanges(
          cursorMs,
          cursorId,
          limit,
        );
        const slice = rows.length > limit ? rows.slice(0, limit) : rows;
        allChanges.push(...slice.map(SyncDataMapper.stateRowToChange));
      } else if (table === 'district') {
        const rows = await this.syncRepository.getDistrictChanges(
          cursorMs,
          cursorId,
          limit,
        );
        const slice = rows.length > limit ? rows.slice(0, limit) : rows;
        allChanges.push(...slice.map(SyncDataMapper.districtRowToChange));
      } else if (table === 'routes') {
        const rows = await this.syncRepository.getRouteChanges(
          cursorMs,
          cursorId,
          limit,
        );
        const slice = rows.length > limit ? rows.slice(0, limit) : rows;
        allChanges.push(...slice.map(SyncDataMapper.routeRowToChange));
      }
    }

    const hasMore = allChanges.length >= limit;
    const nextCursor = this.buildNextCursor(allChanges, cursor);

    this.logger.debug(
      `Changes: ${allChanges.length} row(s) across [${requestedTables.join(',')}], hasMore=${hasMore}, nextCursor=${nextCursor}`,
    );

    return { nextCursor, hasMore, changes: allChanges };
  }

  /**
   * Compute a SHA-256 digest of the canonical operation payload.
   * Used as the `request_hash` in the idempotency log to detect
   * replays where the same key is resubmitted with different data.
   */
  private hashOperation(op: SyncOperation): string {
    const payload = `${op.op}:${op.table}:${canonicalJson(op.opData)}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verify a single operation's signature against the session signing key.
   *
   * Mobile computes: SHA256(signingKey:op:table:canonicalJson(opData))
   * We replicate that computation server-side and compare with timing-safe equal.
   *
   * Uses canonical JSON (sorted keys, deterministic) to ensure cross-engine
   * consistency between Hermes (mobile) and V8 (server). Without this,
   * JSON.stringify key order is engine-dependent and the same logical payload
   * can produce different signatures.
   *
   * Returns true if signature is valid or if no signature was provided (graceful degradation
   * for older clients that predate this feature). Returns false if signature is present but wrong.
   */
  private verifyOperationSignature(
    op: SyncOperation & { signature?: string },
    signingKey: string,
  ): boolean {
    if (!op.signature) {
      this.logger.debug(
        `Operation ${op.id} has no signature — passing without verification`,
      );
      return true;
    }

    const canonical = `${op.op}:${op.table}:${canonicalJson(op.opData)}`;
    const input = `${signingKey}:${canonical}`;
    const expected = crypto.createHash('sha256').update(input).digest('hex');

    const sigBuf = Buffer.from(op.signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Re-validate the offline session HMAC submitted by the mobile client.
   * Mirrors the signing logic in TokenService.signOfflineSessionPayload().
   * Throws ForbiddenException if the signature is missing, mismatched, or
   * the session has expired — preventing tampered payloads from being accepted.
   */
  private async validateOfflineSessionSignature(
    session: OfflineSessionContext,
  ): Promise<void> {
    if (!session) return;

    if (session.offlineValidUntil < Date.now()) {
      throw new ForbiddenException('Offline session has expired');
    }

    const secret = this.configService.getOrThrow<string>(
      'OFFLINE_SESSION_HMAC_SECRET',
    );
    const isValid = verifyOfflineSession(
      {
        userId: session.userId,
        storeId: session.storeId,
        roles: session.roles,
        offlineValidUntil: session.offlineValidUntil,
      },
      secret,
      session.signature,
    );

    if (!isValid) {
      throw new ForbiddenException('Offline session signature invalid');
    }

    // Device revocation check — reject devices whose session was explicitly terminated,
    // even if the 3-day HMAC is still cryptographically valid.
    if (session.deviceId) {
      const isRevoked = await this.revokedDevicesRepository.isRevoked(
        session.userId,
        session.deviceId,
      );
      if (isRevoked) {
        throw new ForbiddenException('Device access has been revoked');
      }
    }

    // Offline JWT write-guard — verify the RS256 offline token and cross-validate
    // its claims against the HMAC-verified session payload.
    //
    // This closes the write-guard gap: the HMAC proves the payload was server-issued
    // and not tampered; the JWT verification proves the token itself is cryptographically
    // valid and unexpired. Cross-validation ensures the two credentials refer to the
    // same session (prevents mixing a valid JWT with a tampered HMAC payload).
    //
    // Graceful degradation: older clients that do not yet send offlineToken are
    // still accepted — the HMAC + device revocation checks above remain the primary guard.
    if (session.offlineToken) {
      let jwtPayload: ReturnType<
        typeof this.jwtConfigService.verifyOfflineToken
      >;
      try {
        jwtPayload = this.jwtConfigService.verifyOfflineToken(
          session.offlineToken,
        );
      } catch {
        throw new ForbiddenException('Offline token is invalid or expired');
      }

      // Cross-validate: JWT roles must match HMAC-signed roles (sorted comparison)
      const jwtRolesSorted = [...jwtPayload.roles].sort().join(',');
      const hmacRolesSorted = [...session.roles].sort().join(',');
      if (jwtRolesSorted !== hmacRolesSorted) {
        throw new ForbiddenException(
          'Offline token roles do not match session',
        );
      }

      // Cross-validate: JWT activeStoreId must match HMAC-signed storeId
      if (jwtPayload.activeStoreId !== session.storeId) {
        throw new ForbiddenException(
          'Offline token store does not match session',
        );
      }
    }
  }

  /**
   * Route a single sync operation to the correct domain handler.
   *
   * Add cases here as domain tables are introduced (products, orders, etc.).
   * Tables with no registered handler are logged and skipped — safe to deploy
   * before the corresponding handler is implemented.
   */
  private async processOperation(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: unknown,
  ): Promise<void> {
    await this.syncHandlerFactory.handle(op, userId, activeStoreId, tx);
  }
}
