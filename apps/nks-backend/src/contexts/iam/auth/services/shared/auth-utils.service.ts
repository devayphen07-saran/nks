import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectAuth } from '../../decorators/inject-auth.decorator';
import type { Auth } from '../../config/better-auth';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import type { UserRoleEntry } from '../../mappers/auth-mapper';

/** BetterAuth internal interface — wrapped once here to avoid duplication. */
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
    private readonly rolesRepository: RolesRepository,
  ) {}

  /** Look up a system role ID, caching the result for the lifetime of this service instance. */
  async getCachedSystemRoleId(roleCode: string): Promise<number | null> {
    if (this.roleIdCache.has(roleCode)) return this.roleIdCache.get(roleCode) ?? null;
    const id = await this.rolesRepository.findSystemRoleId(roleCode);
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
