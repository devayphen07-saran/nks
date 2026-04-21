import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/auth.guard';
import type {
  SessionUser,
  SessionUserKey,
} from '../../contexts/iam/auth/interfaces/session-user.interface';

/**
 * Parameter decorator that extracts the authenticated user (or a specific
 * field) from the request after AuthGuard has validated the session.
 *
 * ⚠️  Always use `userId` (number) for DB queries — NOT `id` (guuid string).
 *
 * @example
 * // Full user object
 * @CurrentUser() user: SessionUser
 *
 * // DB primary key — use this for all repository calls
 * @CurrentUser('userId') userId: number
 *
 * // Other available fields
 * @CurrentUser('email') email: string
 * @CurrentUser('name')  name: string
 */
export const CurrentUser = createParamDecorator(
  (
    field: SessionUserKey | undefined,
    ctx: ExecutionContext,
  ): SessionUser | SessionUser[SessionUserKey] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return field ? user[field] : user;
  },
);
