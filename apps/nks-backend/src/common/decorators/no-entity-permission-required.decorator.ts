import { SetMetadata } from '@nestjs/common';

export const NO_ENTITY_PERMISSION_REQUIRED_KEY = 'noEntityPermissionRequired';

/**
 * Explicit documentation decorator for authenticated endpoints that
 * intentionally do NOT use @RequireEntityPermission.
 *
 * Every non-public endpoint must be one of:
 *   1. @RequireEntityPermission(...)  — entity-level RBAC enforced
 *   2. @Public()                      — unauthenticated access allowed
 *   3. @NoEntityPermissionRequired()  — authenticated, but self-service or
 *                                       structurally safe (see reason string)
 *
 * The `reason` string is mandatory — it forces the developer to articulate
 * WHY the endpoint skips entity permission enforcement. Valid reasons:
 *   - 'self-service: user reading/writing their own data only'
 *   - 'structural: store membership enforced by StoresService.setDefaultStoreIfMember'
 *   - 'platform: enforced by isSuperAdmin check in the service layer'
 *
 * This metadata is read by startup audit tooling to produce a report of
 * unprotected write endpoints — catch misconfigured controllers at deploy time,
 * not at runtime.
 *
 * @example
 *   @NoEntityPermissionRequired('self-service: user reading their own profile')
 *   @Get('me')
 *   getMe(@CurrentUser() user: SessionUser) { ... }
 */
export const NoEntityPermissionRequired = (reason: string) =>
  SetMetadata(NO_ENTITY_PERMISSION_REQUIRED_KEY, reason);
