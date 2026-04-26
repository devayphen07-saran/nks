import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionEvaluatorService } from '../../contexts/iam/roles/permission-evaluator.service';
import { StoreQueryService } from '../../contexts/organization/stores/store-query.service';
import { assertHasRoleInStore } from '../utils/permission-checker';
import { ErrorCode } from '../constants/error-codes.constants';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  EntityPermissionRequirement,
} from '../decorators/require-entity-permission.decorator';
import { ENTITY_RESOURCE_KEY } from '../decorators/entity-resource.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RBACGuard — entity permission access control.
 *
 * Reads `@RequireEntityPermission()` metadata and delegates the decision to
 * `PermissionEvaluatorService`. The evaluator owns the SUPER_ADMIN bypass,
 * role selection, and grant merging.
 *
 * This guard only adds HTTP-layer concerns that don't belong in the evaluator:
 *   - STORE scope: require and validate `user.activeStoreId` before calling
 *     the evaluator. Confirms the store is still active (indexed PK lookup,
 *     no in-process cache — see H-1 audit) and that the user holds a role
 *     in it (defends against a stale session).
 *   - PLATFORM scope: no store context is required; the evaluator reads
 *     against the user's platform roles directly.
 *
 * Usage:
 *   @UseGuards(RBACGuard)
 *   @RequireEntityPermission({ entityCode: EntityCodes.INVOICE, action: 'create' })
 *
 *   @UseGuards(RBACGuard)
 *   @RequireEntityPermission({
 *     entityCode: EntityCodes.AUDIT_LOG,
 *     action: 'view',
 *     scope: 'PLATFORM',
 *   })
 */
@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly storeQuery: StoreQueryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const requirement = this.reflector.getAllAndOverride<
      EntityPermissionRequirement | undefined
    >(REQUIRE_ENTITY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No decorator on this handler — nothing to enforce.
    if (!requirement) return true;

    // ── Resolve entity code ──────────────────────────────────────────────────
    // Three-tier resolution (first match wins):
    //   1. method entityCode  — static string on @RequireEntityPermission
    //   2. method routeParam  — URL path param resolved at runtime
    //   3. class @EntityResource — controller-level fallback
    const classEntityCode = this.reflector.get<string | undefined>(
      ENTITY_RESOURCE_KEY,
      context.getClass(),
    );
    const entityCode = this.resolveEntityCode(
      requirement,
      request,
      classEntityCode,
    );

    // Validate the resolved code against the DB-loaded registry.
    // This catches both developer errors (typo in decorator) and cases where
    // an entity type was deleted from the DB but the code is still referenced.
    // Super-admins bypass permission evaluation but NOT entity code validation —
    // an unknown entity code is a configuration error, not a permission issue.
    if (!this.permissionEvaluator.isKnownEntityCode(entityCode)) {
      throw new BadRequestException({
        errorCode: ErrorCode.ENTITY_CODE_UNKNOWN,
        message: `Unknown entity code: '${entityCode}'. Ensure it exists in the entity_type table.`,
      });
    }

    const scope = requirement.scope ?? 'STORE';

    if (scope === 'STORE') {
      this.assertStoreContext(user);
      const storeId = user.activeStoreId as number;

      // Single query: active check + ownership in one round-trip.
      // Eliminates the TOCTOU window that existed when isActive() and
      // isStoreOwner() were two separate queries (store could be deactivated
      // between them).
      const storeCtx = await this.storeQuery.findActiveWithOwnership(user.userId, storeId);
      if (!storeCtx) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'Store not found or inactive',
        });
      }
      // Store owners (ownerUserFk) bypass the role-row membership check.
      // The ownership model migrated from a STORE_OWNER role entry to
      // store.ownerUserFk — a pure owner with no role assignment must still
      // pass STORE-scope guards on their own store.
      if (!storeCtx.isOwner) {
        assertHasRoleInStore(user.roles ?? [], storeId);
      }
    }

    const permitted = await this.permissionEvaluator.evaluate(
      {
        activeStoreId: user.activeStoreId ?? null,
        roles: user.roles ?? [],
      },
      {
        entityCode,
        action: requirement.action,
        scope,
      },
    );

    if (!permitted) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Insufficient permissions',
      });
    }

    return true;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * Resolves the entity code using a three-tier priority chain:
   *   1. method `entityCode`  — static string on @RequireEntityPermission
   *   2. method `routeParam`  — URL path param resolved at runtime
   *   3. `classEntityCode`    — value from @EntityResource on the controller class
   * Throws BadRequestException when none of the three yields a value.
   */
  private resolveEntityCode(
    requirement: EntityPermissionRequirement,
    request: AuthenticatedRequest,
    classEntityCode: string | undefined,
  ): string {
    if (requirement.entityCode) {
      return requirement.entityCode;
    }

    if (requirement.routeParam) {
      const value = (request.params as Record<string, string>)[
        requirement.routeParam
      ];
      if (!value) {
        throw new BadRequestException({
          errorCode: ErrorCode.ENTITY_CODE_UNKNOWN,
          message: `Route parameter '${requirement.routeParam}' is missing or empty.`,
        });
      }
      return value.toUpperCase();
    }

    if (classEntityCode) {
      return classEntityCode;
    }

    throw new BadRequestException({
      errorCode: ErrorCode.ENTITY_CODE_UNKNOWN,
      message:
        'Invalid permission configuration: entityCode, routeParam, or @EntityResource is required.',
    });
  }

  private assertStoreContext(user: AuthenticatedRequest['user']): void {
    if (!user.activeStoreId) {
      // Distinct from INSUFFICIENT_PERMISSIONS: the user is authenticated but
      // has no store context — they must select a store before accessing
      // STORE-scoped endpoints. Mobile client should prompt store selection.
      throw new ForbiddenException({
        errorCode: ErrorCode.AUTH_NO_STORE_CONTEXT,
        message: 'No active store selected',
      });
    }
  }

}
