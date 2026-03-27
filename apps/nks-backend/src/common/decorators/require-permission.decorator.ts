import { SetMetadata } from '@nestjs/common';

/**
 * RequirePermission decorator specifies what permission is required to access an endpoint
 *
 * Usage:
 * @RequirePermission('customers', 'create')
 * async createCustomer(@Body() dto: CreateCustomerDto) {}
 *
 * @RequirePermission('reports', 'view')
 * async getReports() {}
 *
 * The permission is checked by PermissionGuard
 */
export const RequirePermission = (resource: string, action: string) => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      SetMetadata('permission_resource', resource)(target, propertyKey, descriptor);
      SetMetadata('permission_action', action)(target, propertyKey, descriptor);
    }
  };
};

/**
 * Alternative: Apply both resource and action at once
 * Used in conjunction with PermissionGuard
 */
export const Permission = (resource: string, action: string) =>
  SetMetadata('permissions', [{ resource, action }]);
