import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RBACGuard } from '../guards/rbac.guard';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  type EntityPermissionAction,
} from './require-entity-permission.decorator';

/**
 * Composite decorator: RBAC guard + entity permission metadata + Swagger auth.
 *
 * AuthGuard is already registered as a global APP_GUARD — adding it here would
 * cause it to run twice. Only RBACGuard needs to be listed explicitly.
 *
 * Replaces this boilerplate on every protected method:
 *   @UseGuards(RBACGuard)
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
    UseGuards(RBACGuard),
    ApiBearerAuth(),
  );
}

/**
 * Composite decorator for dynamic entity codes resolved from a URL route parameter.
 *
 * Replaces:
 *   @UseGuards(RBACGuard)
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
    UseGuards(RBACGuard),
    ApiBearerAuth(),
  );
}
