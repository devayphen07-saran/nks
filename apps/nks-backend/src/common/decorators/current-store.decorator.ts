import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';
import type { AuthenticatedRequest } from '../guards/auth.guard';

/**
 * Extracts the authenticated user's currently selected active store.
 * Throws BadRequestException if user has no active store selected.
 *
 * This ensures record-level security by providing the user's store context
 * directly from the authenticated session, not from request parameters.
 *
 * Usage:
 *   @Get('/invoices')
 *   async getInvoices(@CurrentStore() storeId: number) {
 *     // storeId is guaranteed to be the user's active store
 *   }
 */
export const CurrentStore = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const storeId = request.user?.activeStoreId;

    if (!storeId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'No active store selected. User must select a store after login.',
      });
    }

    return storeId;
  },
);
