import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * OwnershipGuard — ensures the authenticated user owns the resource whose
 * identifier is passed in the URL path. SUPER_ADMIN bypasses the check.
 *
 * Accepted path parameters (in resolution order):
 *   - `:iamUserId`  → matched against req.user.iamUserId
 *                     (ayphen-style identity key — `/users/:iamUserId/...`)
 *   - `:userGuuid`  → matched against req.user.guuid
 *   - `:guuid`      → matched against req.user.guuid (fallback convention)
 *
 * Usage:
 *   @UseGuards(AuthGuard, OwnershipGuard)
 *   @Get(':iamUserId/favorites')
 *   async getFavorites(@Param('iamUserId') iamUserId: string) { ... }
 *
 * Security note: closes the known ayphen Java backend gap where
 * `@PreAuthorize` checks generic role permissions but does NOT verify the
 * URL-provided `iamUserId` against the authenticated caller. Never mount a
 * `/users/:iamUserId/...` route without this guard (unless it is admin-only).
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user.isSuperAdmin) return true;

    const params = request.params ?? {};

    // iamUserId takes precedence — it's the canonical external identifier
    // used by ayphen clients. A route that declares it is explicitly opting
    // into the ayphen identity scheme.
    if (params.iamUserId !== undefined) {
      if (user.iamUserId !== params.iamUserId) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'You can only access your own resources',
        });
      }
      return true;
    }

    const paramGuuid = params.userGuuid ?? params.guuid;
    if (!paramGuuid || user.guuid !== paramGuuid) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'You can only access your own resources',
      });
    }

    return true;
  }
}
