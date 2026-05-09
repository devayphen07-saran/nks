import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DeviceContext } from '../types/device-context';

/**
 * @CurrentDevice() param decorator — extracts DeviceContext from request.
 *
 * DeviceAuthGuard populates req.deviceContext with:
 *   { deviceId, userId, storeId }
 *
 * Usage in controller:
 *   @Get('pull')
 *   async pull(
 *     @Query() query: PullQueryDto,
 *     @CurrentDevice() device: DeviceContext,
 *   ) { ... }
 */
export const CurrentDevice = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DeviceContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.deviceContext;
  },
);
