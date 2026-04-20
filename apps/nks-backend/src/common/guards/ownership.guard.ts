import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * OwnershipGuard — ensures the authenticated user owns the resource.
 *
 * Compares req.user.userId against req.params.userId (or req.params.id).
 * SUPER_ADMIN bypasses the check.
 *
 * Usage:
 *   @UseGuards(AuthGuard, OwnershipGuard)
 *   async getMyData(@Param('userId') userId: number) {}
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.UNAUTHORIZED,
        message: 'User not found or authenticated',
      });
    }

    if (user.isSuperAdmin) return true;

    const paramUserId =
      Number(request.params?.userId) || Number(request.params?.id);

    if (!paramUserId || user.userId !== paramUserId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'You can only access your own resources',
      });
    }

    return true;
  }
}
