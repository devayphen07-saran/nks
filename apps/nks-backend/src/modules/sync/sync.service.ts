import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SyncRepository } from './repositories/sync.repository';
import { SyncDataMapper } from './mappers/sync-data.mapper';
import { SyncDataValidator } from './validators/sync-data.validator';
import { RevokedDevicesRepository } from '../auth/repositories/revoked-devices.repository';
import { JWTConfigService } from '../../config/jwt.config';
import type { SyncOperation, ChangesResponse, OfflineSessionContext } from './dto';

export type { ChangesResponse };

const DEFAULT_SYNC_LIMIT = 500;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly configService: ConfigService,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
    private readonly jwtConfigService: JWTConfigService,
  ) {}

  /**
   * Process a batch of sync push operations from the mobile offline sync queue.
   *
   * Each operation is wrapped in a transaction with its idempotency
   * log entry so a crash between the mutation and the log write
   * never causes re-processing on retry.
   */
  async processPushBatch(
    operations: SyncOperation[],
    userId: number,
    activeStoreId: number | null,
    offlineSession?: OfflineSessionContext,
  ): Promise<{ processed: number }> {
    if (offlineSession) {
      await this.validateOfflineSessionSignature(offlineSession);
    }

    // Derive the per-session signing key used by the mobile to sign each operation.
    // Mobile computes: SHA256(sessionSignature + ":" + canonicalPayload)
    // We re-derive the session signature here so we can verify each mutation.
    const signingKey = offlineSession?.signature ?? null;
    let processed = 0;

    for (const op of operations) {
      if (!SyncDataValidator.isValidOp(op.op)) {
        this.logger.warn(`Unknown op "${op.op}" for ${op.id} — skipped`);
        continue;
      }

      if (signingKey) {
        if (!this.verifyOperationSignature(op, signingKey)) {
          this.logger.warn(`Operation ${op.id} rejected — signature mismatch`);
          continue;
        }
      }

      const idempotencyKey = `${op.clientId}-${op.id}`;
      let wasProcessed = false;

      await this.syncRepository.withTransaction(async (tx) => {
        const alreadySeen = await this.syncRepository.isAlreadyProcessed(idempotencyKey, tx);

        if (alreadySeen) {
          this.logger.log(`Duplicate skipped: ${idempotencyKey}`);
          return;
        }

        await this.processOperation(op, userId, activeStoreId, tx);
        await this.syncRepository.logIdempotencyKey(idempotencyKey, tx);
        wasProcessed = true;
      });

      if (wasProcessed) processed++;
    }

    return { processed };
  }

  /**
   * Fetch changes since a given cursor for pull-based sync.
   *
   * Validates user membership in the store, then fetches route changes
   * since the cursor timestamp. Returns nextCursor and hasMore flag.
   */
  async getChanges(
    userId: number,
    cursorMs: number,
    storeGuuid: string,
  ): Promise<ChangesResponse> {
    const storeId = await this.syncRepository.verifyStoreMembership(userId, storeGuuid);

    if (!storeId) {
      throw new ForbiddenException(
        'You do not have access to this store or it does not exist.',
      );
    }

    const limit = DEFAULT_SYNC_LIMIT;
    const routeRows = await this.syncRepository.getRouteChanges(cursorMs, limit);

    const hasMore = routeRows.length > limit;
    const rows = hasMore ? routeRows.slice(0, limit) : routeRows;

    const changes = rows.map(SyncDataMapper.routeRowToChange);
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].updatedAt.getTime() : cursorMs;

    this.logger.debug(`Changes: ${changes.length} row(s), hasMore=${hasMore}, nextCursor=${nextCursor}`);

    return { nextCursor, hasMore, changes };
  }

  /**
   * Verify a single operation's signature against the session signing key.
   *
   * Mobile computes: SHA256(sessionSignature + ":" + op + ":" + table + ":" + JSON.stringify(opData))
   * We replicate that computation server-side and compare with timing-safe equal.
   *
   * Returns true if signature is valid or if no signature was provided (graceful degradation
   * for older clients that predate this feature). Returns false if signature is present but wrong.
   */
  private verifyOperationSignature(
    op: SyncOperation & { signature?: string },
    signingKey: string,
  ): boolean {
    if (!op.signature) {
      // No signature — older client or client without session context. Allow through
      // but log so we can tighten to hard-reject once all clients are updated.
      this.logger.debug(`Operation ${op.id} has no signature — passing without verification`);
      return true;
    }

    const canonical = `${op.op}:${op.table}:${JSON.stringify(op.opData)}`;
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
  private async validateOfflineSessionSignature(session: OfflineSessionContext): Promise<void> {
    if (!session) return;

    if (session.offlineValidUntil < Date.now()) {
      throw new ForbiddenException('Offline session has expired');
    }

    const secret = this.configService.getOrThrow<string>('OFFLINE_SESSION_HMAC_SECRET');
    const data = JSON.stringify({
      userId: session.userId,
      storeId: session.storeId,
      roles: [...session.roles].sort(),
      offlineValidUntil: session.offlineValidUntil,
    });
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');

    const sigBuffer = Buffer.from(session.signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
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
      let jwtPayload: ReturnType<typeof this.jwtConfigService.verifyOfflineToken>;
      try {
        jwtPayload = this.jwtConfigService.verifyOfflineToken(session.offlineToken);
      } catch {
        throw new ForbiddenException('Offline token is invalid or expired');
      }

      // Cross-validate: JWT roles must match HMAC-signed roles (sorted comparison)
      const jwtRolesSorted = [...jwtPayload.roles].sort().join(',');
      const hmacRolesSorted = [...session.roles].sort().join(',');
      if (jwtRolesSorted !== hmacRolesSorted) {
        throw new ForbiddenException('Offline token roles do not match session');
      }

      // Cross-validate: JWT activeStoreId must match HMAC-signed storeId
      if (jwtPayload.activeStoreId !== session.storeId) {
        throw new ForbiddenException('Offline token store does not match session');
      }
    }
  }

  /**
   * Route a single sync operation to the correct domain handler.
   * Tables with no registered handler are logged and skipped.
   */
  private async processOperation(
    op: SyncOperation,
    _userId: number,
    _activeStoreId: number | null,
    _tx: unknown,
  ): Promise<void> {
    this.logger.warn(
      `No handler registered for sync table "${op.table}" — operation ${op.id} skipped`,
    );
  }
}
