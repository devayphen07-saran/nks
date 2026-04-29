import { Injectable, Logger } from '@nestjs/common';
import type { DbTransaction } from '../../../../../core/database/transaction.service';
import { RoleMutationService } from '../../../roles/role-mutation.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { RoleQueryService } from '../../../roles/role-query.service';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import {
  InternalServerException,
} from '../../../../../common/exceptions';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';

/**
 * InitialRoleAssignmentService — assigns initial role to newly registered users.
 *
 * Extracted from PasswordAuthService to own:
 *   - System role ID resolution (cached)
 *   - Initial role determination (SUPER_ADMIN if first user, USER otherwise)
 *   - Transactional role assignment (within user creation transaction)
 *   - Error handling for missing system roles
 *
 * Dependencies (3):
 *   - roleMutation (transactional role assignment)
 *   - authUtils (cached system role ID lookup)
 *   - roleQuery (checking if first user to assign SUPER_ADMIN)
 */
@Injectable()
export class InitialRoleAssignmentService {
  private readonly logger = new Logger(InitialRoleAssignmentService.name);

  constructor(
    private readonly roleMutation: RoleMutationService,
    private readonly authUtils: AuthUtilsService,
    private readonly roleQuery: RoleQueryService,
  ) {}

  /**
   * Assign initial role to a new user within the user creation transaction.
   * First user becomes SUPER_ADMIN, subsequent users become USER.
   *
   * Must be called from within createUserWithInitialRole's transaction callback.
   */
  async assignInitialRoleInTransaction(
    userId: number,
    tx: DbTransaction,
  ): Promise<void> {
    try {
      const superAdminRoleId = await this.authUtils.getCachedSystemRoleId(
        SystemRoleCodes.SUPER_ADMIN,
      );
      if (!superAdminRoleId) {
        this.logger.error(
          'SUPER_ADMIN system role not seeded — cannot assign initial role. Run DB seed before accepting registrations.',
        );
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
      }
      const roleCode =
        await this.roleMutation.resolveInitialRoleWithinTransaction(
          tx,
          superAdminRoleId,
        );
      const assigned = await this.roleMutation.assignRoleWithinTransaction(
        tx,
        userId,
        roleCode,
      );
      if (!assigned)
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
    } catch (err) {
      this.logger.error(
        `assignInitialRoleInTransaction failed for userId=${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
