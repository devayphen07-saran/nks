import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';
import { ForbiddenException } from '../exceptions';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * OwnershipGuard — ensures the authenticated user owns the resource whose
 * identifier is passed in the URL path.
 *
 * Accepted path parameters (in resolution order):
 *   - `:iamUserId`  → matched against req.user.iamUserId
 *   - `:userGuuid`  → matched against req.user.guuid
 *   - `:guuid`      → matched against req.user.guuid (fallback convention)
 *
 * Usage:
 *   @UseGuards(AuthGuard, OwnershipGuard)
 *   @Get(':iamUserId/favorites')
 *   async getFavorites(@Param('iamUserId') iamUserId: string) { ... }
 *
 * Security note: Always verify the URL-provided `iamUserId` against the
 * authenticated caller. Never mount a `/users/:iamUserId/...` route without
 * this guard (unless it is admin-only).
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    const params = request.params ?? {};

    // iamUserId takes precedence — it's the canonical external identifier
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
