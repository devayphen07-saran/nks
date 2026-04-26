import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';
import { EntityCodes } from '../../../../common/constants/entity-codes.constants';

/**
 * RolesValidator
 *
 * Business-rule validation for role CRUD operations.
 * Extracted from RolesService so the service is pure orchestration.
 */
export class RolesValidator {
  /**
   * Ensure a store was found by guuid; throw 404 otherwise.
   */
  static assertStoreFound(storeId: number | null): asserts storeId is number {
    if (storeId === null) {
      throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));
    }
  }

  /**
   * Ensure the target storeId matches the caller's active store.
   */
  static assertStoreMatch(activeStoreId: number | null, targetStoreId: number): void {
    if (activeStoreId !== targetStoreId) {
      throw new BadRequestException(errPayload(ErrorCode.ROLE_STORE_MISMATCH));
    }
  }

  /**
   * Ensure a role belongs to the caller's active store (for store-scoped roles).
   */
  static assertRoleStoreAccess(roleStoreFk: number | null, activeStoreId: number | null): void {
    if (roleStoreFk && roleStoreFk !== activeStoreId) {
      throw new BadRequestException(errPayload(ErrorCode.ROLE_STORE_MISMATCH));
    }
  }

  /**
   * Ensure the code does not collide with a system role already in the DB.
   * The `isSystemCode` flag comes from a `findSystemRoleId` lookup in the service —
   * the validator never touches the DB directly.
   */
  static assertCodeNotReserved(isSystemCode: boolean): void {
    if (isSystemCode) {
      throw new BadRequestException(errPayload(ErrorCode.ROLE_CODE_RESERVED));
    }
  }

  /**
   * Ensure a system role is not being mutated.
   * System roles (isSystem=true) are immutable by design — they define the
   * platform's permission model and must not be modified by any store user.
   */
  static assertRoleNotSystem(isSystem: boolean): void {
    if (isSystem) {
      throw new ForbiddenException(errPayload(ErrorCode.ROLE_IS_SYSTEM));
    }
  }

  /**
   * Ensure an active store is set; required for permission ceiling checks.
   */
  static assertActiveStoreId(activeStoreId: number | null): asserts activeStoreId is number {
    if (activeStoreId === null) {
      throw new ForbiddenException(errPayload(ErrorCode.INSUFFICIENT_PERMISSIONS));
    }
  }

  /**
   * Ensure a role was found; throw 404 otherwise.
   */
  static assertFound<T>(role: T | null | undefined): asserts role is T {
    if (!role) {
      throw new NotFoundException(errPayload(ErrorCode.ROLE_NOT_FOUND));
    }
  }

  // ─── Permission ceiling ────────────────────────────────────────────────────

  /** Entity codes that can never be delegated to custom roles. */
  private static readonly NON_DELEGATABLE = new Set<string>([
    EntityCodes.ROLE,
    EntityCodes.AUDIT_LOG,
    EntityCodes.USER,
  ]);

  /**
   * Validate every requested entity-permission against the caller's ceiling.
   * Throws on the first violation — fail fast, all-or-nothing.
   */
  static assertPermissionCeiling(
    entityEntries: [string, Record<string, boolean>][],
    callerPerms: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; deny?: boolean }>,
  ): void {
    for (const [entityCode, requested] of entityEntries) {
      if (this.NON_DELEGATABLE.has(entityCode)) {
        throw new ForbiddenException(errPayload(ErrorCode.ROLE_PERMISSION_NON_DELEGATABLE));
      }

      const ceiling = callerPerms[entityCode];
      if (!ceiling || ceiling.deny) {
        throw new ForbiddenException(errPayload(ErrorCode.ROLE_PERMISSION_NO_ACCESS));
      }

      for (const action of ['canView', 'canCreate', 'canEdit', 'canDelete'] as const) {
        if (requested[action] && !ceiling[action]) {
          throw new ForbiddenException(errPayload(ErrorCode.ROLE_PERMISSION_CEILING_EXCEEDED));
        }
      }
    }
  }
}
