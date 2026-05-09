import { SetMetadata } from '@nestjs/common';

export const NO_ENTITY_PERMISSION_REQUIRED_KEY = 'noEntityPermissionRequired';

/**
 * Code-review marker for authenticated endpoints that intentionally do NOT use
 * @RequireEntityPermission. NO RUNTIME EFFECT — this metadata is not read by
 * any guard; it exists so reviewers can see at a glance that a missing
 * @RequireEntityPermission was a deliberate decision, not an oversight.
 *
 * Every non-public endpoint should be one of:
 *   1. @RequireEntityPermission(...)  — entity-level RBAC enforced by RBACGuard
 *   2. @Public()                      — unauthenticated access allowed
 *   3. @NoEntityPermissionRequired()  — authenticated, but self-service or
 *                                       structurally safe (see reason string)
 *
 * The `reason` string is mandatory — it forces the developer to articulate
 * WHY the endpoint skips entity permission enforcement. Valid reasons:
 *   - 'self-service: user reading/writing their own data only'
 *   - 'structural: store membership enforced at service layer via X.verifyMembership'
 *   - 'platform: enforced by isSuperAdmin check in the service layer'
 *
 * Coverage is enforced by code review, not by tooling — same model as the
 * Ayphen Java codebase's `PERMISSION_NAME_NR` approach.
 *
 * @example
 *   @NoEntityPermissionRequired('self-service: user reading their own profile')
 *   @Get('me')
 *   getMe(@CurrentUser() user: SessionUser) { ... }
 */
export const NoEntityPermissionRequired = (reason: string) =>
  SetMetadata(NO_ENTITY_PERMISSION_REQUIRED_KEY, reason);
