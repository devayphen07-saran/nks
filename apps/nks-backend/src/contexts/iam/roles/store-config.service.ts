import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { StoreQueryService } from '../../organization/stores/store-query.service';
import { RoleQueryService } from './role-query.service';
import {
  NotFoundException,
  ForbiddenException,
} from '../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import type { RoleEntityPermissions } from './dto/role-response.dto';

/**
 * Snapshot of everything the mobile app needs to gate UI for a single store.
 *
 * The mobile fetches this once per store (on first selection / cache miss /
 * sync). It re-fetches when `version` advances or when `configHash` differs
 * from the cached one — so the wire format is intentionally stable.
 */
export interface StoreConfig {
  store: {
    id:        number;
    guuid:     string;
    storeName: string;
    timezone:  string;
    isDefault: boolean;
    address:   string | null;
    phone:     string | null;
  };
  /** Role codes the requesting user holds in this store (e.g. ['STORE_OWNER']). */
  userRoles: string[];
  /** Per-entity allow/deny map merged across the user's roles in this store. */
  userPermissions: RoleEntityPermissions;
  /**
   * SHA-256 over a deterministic JSON of {store, userRoles, userPermissions}.
   * Mobile re-fetches when this diverges from the cached one — the dedicated
   * `GET /auth/permissions-delta?version=` endpoint handles fine-grained
   * permission sync separately.
   */
  configHash: string;
}

/**
 * Builds the per-store config snapshot for the authenticated user.
 *
 * Authorization contract:
 *   - The caller must be a member of the store (owner or active staff).
 *   - Membership is enforced here. RBACGuard already checks store-scoped
 *     access, but this endpoint deliberately re-checks because it returns
 *     user-scoped permissions and a leak would be cross-tenant.
 */
@Injectable()
export class StoreConfigService {
  private readonly logger = new Logger(StoreConfigService.name);

  constructor(
    private readonly storeQuery: StoreQueryService,
    private readonly roleQuery: RoleQueryService,
  ) {}

  async getConfig(userId: number, storeGuuid: string): Promise<StoreConfig> {
    const ctx = await this.storeQuery.getStoreContextForUser(userId, storeGuuid);
    if (!ctx) {
      // Either the store doesn't exist or the user is not a member.
      // We deliberately do NOT distinguish — this is a tenant-isolation
      // boundary and a 404 vs 403 leak would let a caller probe ids.
      throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));
    }

    const [roleRows, permsByStore] = await Promise.all([
      this.roleQuery.getActiveRolesForStore(userId, ctx.row.id),
      this.roleQuery.getUserEntityPermissionsPerStore(userId, [ctx.row.id]),
    ]);

    if (roleRows.length === 0) {
      // Defensive: getStoreContextForUser already filtered by membership, but
      // if a race removed the user's role between the two queries, surface
      // it explicitly rather than returning an empty role list.
      throw new ForbiddenException(errPayload(ErrorCode.FORBIDDEN));
    }

    const address = this.formatAddress(ctx.address);
    const userRoles = roleRows.map((r) => r.roleCode);
    const userPermissions = permsByStore[storeGuuid] ?? {};

    const store = {
      id:        ctx.row.id,
      guuid:     ctx.row.guuid,
      storeName: ctx.row.storeName,
      timezone:  ctx.row.timezone,
      isDefault: ctx.row.isDefault,
      address,
      phone:     ctx.phone,
    };

    const configHash = this.computeHash({ store, userRoles, userPermissions });

    return { store, userRoles, userPermissions, configHash };
  }

  private formatAddress(
    address: { line1: string | null; line2: string | null; cityName: string | null } | null,
  ): string | null {
    if (!address) return null;
    const parts = [address.line1, address.line2, address.cityName]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .map((p) => p.trim());
    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Stable SHA-256 hash so the mobile can detect drift without comparing
   * the full payload field-by-field. JSON.stringify with sorted keys is
   * deterministic for the shapes used here (no class instances, no Dates).
   */
  private computeHash(payload: object): string {
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }
}
