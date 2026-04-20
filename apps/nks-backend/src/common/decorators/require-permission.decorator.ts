import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { RBACGuard } from '../guards/rbac.guard';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  type EntityPermissionAction,
} from './require-entity-permission.decorator';

/**
 * Composite decorator: auth + RBAC guard + entity permission metadata + Swagger auth.
 *
 * Replaces this boilerplate on every protected method:
 *   @UseGuards(AuthGuard, RBACGuard)
 *   @ApiBearerAuth()
 *   @RequireEntityPermission({ entityCode: EntityCodes.INVOICE, action: 'create' })
 *
 * With a single line:
 *   @RequirePermission(EntityCodes.INVOICE, 'create')
 *
 * @param entityCode  Static entity type code (e.g. EntityCodes.INVOICE)
 * @param action      Permission action: 'view' | 'create' | 'edit' | 'delete'
 */
export function RequirePermission(
  entityCode: string,
  action: EntityPermissionAction,
) {
  return applyDecorators(
    SetMetadata(REQUIRE_ENTITY_PERMISSION_KEY, { entityCode, action }),
    UseGuards(AuthGuard, RBACGuard),
    ApiBearerAuth(),
  );
}

/**
 * Composite decorator for dynamic entity codes resolved from a URL route parameter.
 *
 * Replaces:
 *   @UseGuards(AuthGuard, RBACGuard)
 *   @ApiBearerAuth()
 *   @RequireEntityPermission({ routeParam: 'entityCode', action: 'edit' })
 *
 * With:
 *   @RequirePermissionForParam('entityCode', 'edit')
 *
 * @param routeParam  Name of the URL param that holds the entity code at runtime
 * @param action      Permission action: 'view' | 'create' | 'edit' | 'delete'
 */
export function RequirePermissionForParam(
  routeParam: string,
  action: EntityPermissionAction,
) {
  return applyDecorators(
    SetMetadata(REQUIRE_ENTITY_PERMISSION_KEY, { routeParam, action }),
    UseGuards(AuthGuard, RBACGuard),
    ApiBearerAuth(),
  );
}
