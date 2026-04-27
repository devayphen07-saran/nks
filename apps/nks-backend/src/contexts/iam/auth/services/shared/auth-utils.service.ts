import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectAuth } from '../../decorators/inject-auth.decorator';
import type { Auth } from '../../config/better-auth';
import { RoleQueryService } from '../../../roles/role-query.service';
import type { UserRoleEntry } from '../../mapper/auth-mapper';

/**
 * BetterAuth does not expose $context in its public TypeScript API.
 * This interface documents the exact internal shape we depend on.
 * The cast in getBetterAuthContext() is intentional and isolated here.
 */
interface BetterAuthInternal {
  $context: Promise<{
    internalAdapter: {
      createSession: (
        userId: string,
      ) => Promise<{ token: string; expiresAt: Date } | null>;
    };
  }>;
}

/**
 * AuthUtilsService — shared auth helpers used across token, lifecycle, session,
 * and flow services.
 *
 * Centralises:
 *   - Role ID lookup with per-request cache (getCachedSystemRoleId)
 *   - BetterAuth internal context access (getBetterAuthContext)
 *   - Role hash computation (hashRoles)
 */
@Injectable()
export class AuthUtilsService {
  private readonly roleIdCache = new Map<string, number | null>();

  constructor(
    @InjectAuth() private readonly auth: Auth,
    private readonly roleQuery: RoleQueryService,
  ) {}

  /** Look up a system role ID, caching the result. FIFO-evicts oldest entry when cap (100) is reached. */
  async getCachedSystemRoleId(roleCode: string): Promise<number | null> {
    if (this.roleIdCache.has(roleCode)) return this.roleIdCache.get(roleCode) ?? null;
    const id = await this.roleQuery.findSystemRoleId(roleCode);
    if (this.roleIdCache.size >= 100) {
      const oldest = this.roleIdCache.keys().next().value;
      if (oldest !== undefined) this.roleIdCache.delete(oldest);
    }
    this.roleIdCache.set(roleCode, id);
    return id;
  }

  /** Invalidate one or all cached role IDs (call after a role rename/delete). */
  invalidateRoleCache(roleCode?: string): void {
    roleCode ? this.roleIdCache.delete(roleCode) : this.roleIdCache.clear();
  }

  /** Access BetterAuth's internal adapter for session creation during token rotation. */
  async getBetterAuthContext(): Promise<
    Awaited<BetterAuthInternal['$context']>
  > {
    return (this.auth as unknown as BetterAuthInternal).$context;
  }

  /** Compute a deterministic hash of a role list for change detection. */
  hashRoles(roles: UserRoleEntry[]): string {
    const sorted = roles.map((r) => `${r.roleCode}:${r.storeId ?? 'null'}`).sort();
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
}
