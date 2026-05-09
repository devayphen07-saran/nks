import { Injectable, Logger } from '@nestjs/common';
import { InjectAuth } from '../../decorators/inject-auth.decorator';
import type { Auth } from '../../config/better-auth';
import { RoleQueryService } from '../../../roles/role-query.service';

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
 *   - Active-store resolution (resolveStoreIfMember)
 */
@Injectable()
export class AuthUtilsService {
  private readonly logger = new Logger(AuthUtilsService.name);
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

  /** Access BetterAuth's internal adapter for session creation during token rotation. */
  async getBetterAuthContext(): Promise<
    Awaited<BetterAuthInternal['$context']>
  > {
    return (this.auth as unknown as BetterAuthInternal).$context;
  }

  /**
   * Returns `storeId` only if the user still has a role in that store. Otherwise null.
   * Use to validate `defaultStoreFk` / `activeStoreFk` before trusting them in
   * a token or session — role assignments may have been revoked since last login.
   */
  static resolveStoreIfMember(
    storeId: number | null | undefined,
    roles: ReadonlyArray<{ storeId: number | null }>,
  ): number | null {
    if (storeId == null) return null;
    return roles.some((r) => r.storeId === storeId) ? storeId : null;
  }
}
