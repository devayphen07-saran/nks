import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import type { EntityPermission } from './dto/role-response.dto';
import type {
  EntityPermissionAction,
  EntityPermissionScope,
} from '../../../common/decorators/require-entity-permission.decorator';

const ACTION_FIELD: Record<string, keyof EntityPermission> = {
  VIEW: 'canView',
  CREATE: 'canCreate',
  EDIT: 'canEdit',
  DELETE: 'canDelete',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionRole {
  roleId: number;
  storeId: number | null;
}

export interface EvaluationContext {
  activeStoreId: number | null;
  roles: SessionRole[];
}

export interface EvaluationRequest {
  entityCode: string;
  action: EntityPermissionAction;
  scope?: EntityPermissionScope;
}

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

// ─── In-process TTL cache ────────────────────────────────────────────────────

/**
 * Lightweight TTL cache — no external dependency.
 * Key: `${sortedRoleIds}:${entityCode}:${action}`
 * Eviction: lazy (on read) + explicit invalidation when a role's permissions change.
 */
class PermissionCache {
  private readonly store = new Map<string, CacheEntry>();
  // Secondary index: roleId → set of cache keys that include that role.
  // Allows invalidateForRole() to evict in O(k) instead of O(n) full-scan.
  private readonly roleIdToKeys = new Map<number, Set<string>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize = 5_000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): boolean | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.removeFromIndex(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: boolean): void {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) {
        this.store.delete(first);
        this.removeFromIndex(first);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    // Register in secondary index for each roleId in the key.
    const roleSegment = key.split(':')[0];
    for (const part of roleSegment.split(',')) {
      const id = Number(part);
      if (!Number.isNaN(id)) {
        let keys = this.roleIdToKeys.get(id);
        if (!keys) {
          keys = new Set();
          this.roleIdToKeys.set(id, keys);
        }
        keys.add(key);
      }
    }
  }

  /**
   * Evict all entries that involve `roleId`.
   * Uses secondary index for O(k) lookup instead of O(n) full-scan.
   */
  invalidateForRole(roleId: number): void {
    const keys = this.roleIdToKeys.get(roleId);
    if (!keys) return;
    for (const key of keys) {
      this.store.delete(key);
      this.removeFromIndex(key);
    }
    // removeFromIndex already cleans per-key; clear the role's own bucket.
    this.roleIdToKeys.delete(roleId);
  }

  clear(): void {
    this.store.clear();
    this.roleIdToKeys.clear();
  }

  private removeFromIndex(key: string): void {
    const roleSegment = key.split(':')[0];
    for (const part of roleSegment.split(',')) {
      const id = Number(part);
      if (!Number.isNaN(id)) {
        const keys = this.roleIdToKeys.get(id);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) this.roleIdToKeys.delete(id);
        }
      }
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * PermissionEvaluatorService — sole authority for entity-level RBAC decisions.
 *
 *   STORE    → considers roles scoped to `ctx.activeStoreId`
 *   PLATFORM → considers roles with `storeId IS NULL` (system roles)
 *
 * ── In-process TTL cache ─────────────────────────────────────────────────────
 * Caches per-(roleSet, entity, action) results for PERMISSION_CACHE_TTL_MS
 * (default 5 minutes). Invalidated explicitly when a role's permissions change
 * via `invalidateForRole(roleId)`.
 *
 * Multi-pod note: cache is per-process. A change on pod A invalidates pod A
 * immediately; pods B and C serve stale results until TTL expires (≤ 5 min).
 * For sub-second propagation, replace with Redis + pub/sub.
 *
 * Fully DB-driven — no hardcoded role bypasses. SUPER_ADMIN access is
 * controlled entirely by rows in role_permissions seeded at startup.
 */
@Injectable()
export class PermissionEvaluatorService {
  private readonly cache: PermissionCache;

  constructor(
    private readonly rolePermissionsRepository: PermissionsRepository,
    configService: ConfigService,
  ) {
    const ttlMs = configService.get<number>(
      'PERMISSION_CACHE_TTL_MS',
      5 * 60_000,
    );
    this.cache = new PermissionCache(ttlMs);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Decide whether `ctx` can perform `request.action` on `request.entityCode`.
   * Returns true when permitted, false otherwise.
   * Callers are responsible for throwing ForbiddenException on false.
   */
  async evaluate(
    ctx: EvaluationContext,
    request: EvaluationRequest,
  ): Promise<boolean> {
    const scope = request.scope ?? 'STORE';
    const roleIds = this.selectRoleIds(ctx.roles, scope, ctx.activeStoreId);
    if (roleIds.length === 0) return false;

    const cacheKey = `${roleIds.join(',')}:${request.entityCode}:${request.action}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const permissions =
      await this.rolePermissionsRepository.getEntityPermissionsForRoleIds(
        roleIds,
      );

    const entityPerms = permissions[request.entityCode];
    const field = ACTION_FIELD[request.action.toUpperCase()];
    const result =
      !!entityPerms &&
      !entityPerms.deny &&
      !!field &&
      entityPerms[field] === true;

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Evict all cached results that involve `roleId`.
   * Must be called by RolesService after every permission upsert.
   */
  invalidateForRole(roleId: number): void {
    this.cache.invalidateForRole(roleId);
  }

  /**
   * Returns true when `code` exists in the entity_type registry.
   * Used by RBACGuard to validate static and dynamic entity codes in
   * @RequireEntityPermission before reaching the permission evaluation path.
   * The registry is loaded at startup and refreshed after every entity type insert.
   */
  isKnownEntityCode(code: string): boolean {
    return this.rolePermissionsRepository.isKnownEntityCode(code);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Pick the subset of session roles relevant for the requested scope.
   * Returns role IDs sorted ascending (deterministic cache key + DB query).
   */
  private selectRoleIds(
    sessionRoles: SessionRole[],
    scope: EntityPermissionScope,
    activeStoreId: number | null,
  ): number[] {
    const filtered =
      scope === 'PLATFORM'
        ? sessionRoles.filter((r) => r.storeId === null)
        : sessionRoles.filter((r) => r.storeId === activeStoreId);

    return filtered.map((r) => r.roleId).sort((a, b) => a - b);
  }
}
