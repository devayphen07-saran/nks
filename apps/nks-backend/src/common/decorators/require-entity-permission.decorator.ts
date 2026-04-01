import { SetMetadata } from '@nestjs/common';

export type EntityPermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface EntityPermissionRequirement {
  entityCode: string;
  action: EntityPermissionAction;
}

export const REQUIRE_ENTITY_PERMISSION_KEY = 'requireEntityPermission';

/**
 * Decorator for granular entity-based permission checks
 *
 * Usage:
 * @RequireEntityPermission({ entityCode: 'INVOICE', action: 'create' })
 * async createInvoice() {}
 *
 * @RequireEntityPermission({ entityCode: 'PRODUCT', action: 'delete' })
 * async deleteProduct() {}
 */
export const RequireEntityPermission = (
  requirement: EntityPermissionRequirement,
) => SetMetadata(REQUIRE_ENTITY_PERMISSION_KEY, requirement);
