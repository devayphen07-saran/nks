import { Injectable } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import type { DbTransaction } from '../../../core/database/transaction.service';

/**
 * RoleMutationService — narrow mutation surface for role assignments
 * that must run inside an externally-managed transaction.
 *
 * Separated from `RoleQueryService` because transactional mutations can't
 * be pure reads — callers must hand in the active `tx` handle so the
 * operation joins the caller's unit of work. Keeps the coupling
 * structured: iam/auth flows depend on this service, not on
 * `RolesRepository`, and the transactional contract is explicit.
 *
 * See BACKEND_ARCHITECTURE.md § Module-boundary rules.
 */
@Injectable()
export class RoleMutationService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  /**
   * Assign a system role (by code) to a user inside the caller's transaction.
   * Idempotent — silently no-ops if the assignment already exists.
   * Returns false when the role code does not resolve to a system role row.
   *
   * Pass isPrimary=false when assigning a secondary platform role so the
   * partial unique index on (user_fk) WHERE is_primary=true is not violated.
   */
  assignRoleWithinTransaction(
    tx: DbTransaction,
    userId: number,
    roleCode: string,
    isPrimary: boolean = true,
  ): Promise<boolean> {
    return this.rolesRepository.assignRoleWithinTransaction(tx, userId, roleCode, isPrimary);
  }

  /**
   * Decide whether the next user should bootstrap as SUPER_ADMIN.
   * Acquires a transaction-level advisory lock so concurrent first-user
   * registrations serialize deterministically — only one wins.
   */
  resolveInitialRoleWithinTransaction(
    tx: DbTransaction,
    superAdminRoleId: number,
  ): Promise<'SUPER_ADMIN' | 'USER'> {
    return this.rolesRepository.resolveInitialRoleWithinTransaction(
      tx,
      superAdminRoleId,
    );
  }
}
