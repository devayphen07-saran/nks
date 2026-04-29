import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyOfflineSession } from '../../../common/utils/offline-session-hmac';
import { SyncDataValidator } from '../validators/sync-data.validator';
import { SyncAccessValidator } from '../validators/sync-access.validator';
import { DeviceRevocationQueryService } from '../../iam/auth/services/session/device-revocation-query.service';
import { JWTConfigService } from '../../../config/jwt.config';
import type { SyncOperation } from '../dto';
import type { OfflineSessionContextSchema } from '../dto/requests/sync-push.dto';
import type { z } from 'zod';

// OfflineSessionContextSchema is .optional() so the inferred type is T | undefined.
// This alias represents the defined (non-optional) inner shape.
type OfflineSessionPayload = NonNullable<z.infer<typeof OfflineSessionContextSchema>>;

/**
 * SyncValidationService — Offline-first sync validation and authorization.
 *
 * Authorization Contract (Signature-Based, NOT Permission-Based):
 *   - Operations validated via cryptographic HMAC signatures (not permission ceiling)
 *   - Mobile client computes: SHA256(signingKey:op:table:canonicalJson(opData))
 *   - Server replicates computation and verifies via timing-safe comparison
 *   - Device revocation tracked separately for cross-context security
 *
 * Key Design Decision:
 *   - Signature verification proves mobile client had valid offline session at time of operation
 *   - No permission checks here — offline ops are pre-authorized by the offline session HMAC
 *   - Device revocation ensures compromised devices cannot replay old signatures
 *   - Idempotency based on operation hash, not request duplication detection
 *
 * Business Rule Validation:
 *   - Operation type must be known (isValidOp)
 *   - Offline session HMAC must be valid and not expired
 *   - Device must not be revoked (cross-context check)
 *   - Offline JWT claims must match HMAC-verified session payload
 *   - Graceful degradation for older clients (optional signatures/tokens)
 *
 * Audit Trail:
 *   - userId parameter identifies who performed the operation (from session)
 *   - Operation signatures and device revocations are persisted
 */

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
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}';
}

@Injectable()
export class SyncValidationService {
  private readonly logger = new Logger(SyncValidationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly deviceRevocationQuery: DeviceRevocationQueryService,
    private readonly jwtConfigService: JWTConfigService,
  ) {}

  /**
   * Validates an op type is known before opening a transaction.
   * Returns true if valid; caller should count rejections.
   */
  isValidOp(op: SyncOperation): boolean {
    if (!SyncDataValidator.isValidOp(op.op)) {
      this.logger.warn(`Unknown op "${op.op}" for ${op.id} — rejected`);
      return false;
    }
    return true;
  }

  /**
   * Verify a single operation's signature against the session signing key.
   *
   * Mobile computes: SHA256(signingKey:op:table:canonicalJson(opData))
   * We replicate that computation server-side and compare with timing-safe equal.
   *
   * Returns true if signature is valid or absent (graceful degradation for
   * older clients). Returns false only if a signature is present but wrong.
   */
  verifyOperationSignature(
    op: SyncOperation & { signature?: string },
    signingKey: string,
  ): boolean {
    if (!op.signature) {
      this.logger.debug(`Operation ${op.id} has no signature — passing without verification`);
      return true;
    }

    const canonical = `${op.op}:${op.table}:${canonicalJson(op.opData)}`;
    const expected = crypto
      .createHash('sha256')
      .update(`${signingKey}:${canonical}`)
      .digest('hex');

    const sigBuf = Buffer.from(op.signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Compute a SHA-256 digest of the canonical operation payload.
   * Used as request_hash in the idempotency log to detect replays
   * where the same key is resubmitted with different data.
   */
  hashOperation(op: SyncOperation): string {
    const payload = `${op.op}:${op.table}:${canonicalJson(op.opData)}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Re-validate the offline session HMAC submitted by the mobile client.
   * Throws ForbiddenException if the signature is missing, mismatched, expired,
   * or the device has been revoked.
   */
  async validateOfflineSession(
    session: OfflineSessionPayload,
    userId: number,
  ): Promise<void> {
    SyncAccessValidator.assertSessionNotExpired(session.offlineValidUntil);

    const secret = this.configService.getOrThrow<string>('OFFLINE_SESSION_HMAC_SECRET');
    const isValid = verifyOfflineSession(
      {
        userGuuid: session.userGuuid,
        storeGuuid: session.storeGuuid,
        roles: session.roles,
        offlineValidUntil: session.offlineValidUntil,
      },
      secret,
      session.signature,
    );
    SyncAccessValidator.assertSignatureValid(isValid);

    if (session.deviceId) {
      const isRevoked = await this.deviceRevocationQuery.isRevoked(userId, session.deviceId);
      SyncAccessValidator.assertDeviceNotRevoked(isRevoked);
    }

    // Offline JWT write-guard — verify RS256 token and cross-validate claims
    // against the HMAC-verified session payload. Gracefully degrades for
    // older clients that do not send offlineToken.
    if (session.offlineToken) {
      let jwtPayload: ReturnType<typeof this.jwtConfigService.verifyOfflineToken>;
      try {
        jwtPayload = this.jwtConfigService.verifyOfflineToken(session.offlineToken);
      } catch {
        SyncAccessValidator.assertOfflineTokenValid(null);
        return;
      }
      SyncAccessValidator.assertRolesMatch(jwtPayload.roles, session.roles);
      SyncAccessValidator.assertStoreMatch(jwtPayload.activeStoreGuuid, session.storeGuuid);
    }
  }
}
