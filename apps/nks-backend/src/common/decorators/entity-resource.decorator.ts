import { SetMetadata } from '@nestjs/common';

export const ENTITY_RESOURCE_KEY = 'entityResource';

/**
 * Class-level decorator that sets the default entity code for all
 * @RequireEntityPermission methods in the controller.
 *
 * When a method-level @RequireEntityPermission specifies neither `entityCode`
 * nor `routeParam`, RBACGuard falls back to this class-level value, so the
 * entity code is declared once per controller instead of once per method.
 *
 * Resolution priority in RBACGuard:
 *   1. method `entityCode`   — static string on the method decorator
 *   2. method `routeParam`   — dynamic: read from URL path param at runtime
 *   3. @EntityResource        — class-level fallback (this decorator)
 *   → none of the above      — throws 400 ENTITY_CODE_UNKNOWN
 *
 * The entity code is still validated against the DB-loaded entity registry
 * (entity_type table) exactly as it would be for a method-level `entityCode`.
 *
 * @example
 *   @EntityResource('PRODUCT')
 *   @Controller('products')
 *   export class ProductsController {
 *
 *     @Get(':id')
 *     @RequireEntityPermission({ action: 'view' })
 *     getProduct() {}
 *
 *     @Post()
 *     @RequireEntityPermission({ action: 'create' })
 *     createProduct() {}
 *
 *     // Method override still works — AUDIT_LOG takes precedence over PRODUCT
 *     @Get('audit')
 *     @RequireEntityPermission({ entityCode: 'AUDIT_LOG', action: 'view', scope: 'PLATFORM' })
 *     getAudit() {}
 *   }
 *
 * Dynamic endpoints are unaffected — routeParam always wins over @EntityResource:
 *   @Get('entities/:entityCode/records')
 *   @RequireEntityPermission({ routeParam: 'entityCode', action: 'view' })
 *   getRecords() {}
 */
export const EntityResource = (entityCode: string) =>
  SetMetadata(ENTITY_RESOURCE_KEY, entityCode);
