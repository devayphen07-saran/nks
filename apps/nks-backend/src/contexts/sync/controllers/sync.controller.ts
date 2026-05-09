import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from '../sync.service';
import { DeviceAuthGuard } from '../guards/device-auth.guard';
import { NoEntityPermissionRequired } from '../../../common/decorators/no-entity-permission-required.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentDevice } from '../decorators/current-device.decorator';
import {
  PushRequestSchema,
  PullQuerySchema,
  checkPushRequestSize,
  createPushResponse,
} from '../dto';
import type { PushRequest, PullQuery } from '../dto';
import type { DeviceContext } from '../types/device-context';

/**
 * SyncController handles mobile sync endpoints.
 *
 * Two operations:
 * 1. Push: mobile sends local changes (create/update/delete)
 * 2. Pull: mobile pulls server changes since cursor
 *
 * Both routes require:
 * - JWT authentication (global AuthGuard)
 * - Device registration (DeviceAuthGuard)
 */
@ApiTags('Sync')
@Controller('sync')
@UseGuards(DeviceAuthGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Push sync endpoint — apply local changes to server.
   */
  @Post('push')
  @NoEntityPermissionRequired('structural: store-tenancy enforced by DeviceAuthGuard (device_id + user_id + store_id triple) and per-entity store filter inside SyncService.applyOperation')
  @ApiOperation({ summary: 'Apply sync operations (push)' })
  async push(
    @Body(new ZodValidationPipe(PushRequestSchema)) req: PushRequest,
    @Headers('content-length') contentLength: string | undefined,
    @CurrentDevice() device: DeviceContext,
  ) {
    // Check payload size
    checkPushRequestSize(contentLength ? Number(contentLength) : undefined);

    // Apply each operation and collect results
    const results = await Promise.all(
      req.operations.map((op) =>
        this.syncService.applyOperation(
          {
            client_op_id: op.client_op_id,
            sequence: op.sequence,
            entity: op.entity,
            operation: op.operation,
            client_id: op.client_id,
            payload: op.payload,
          },
          device,
        ),
      ),
    );

    return createPushResponse(results);
  }

  /**
   * Pull sync endpoint — fetch server changes since cursor.
   */
  @Get('pull')
  @NoEntityPermissionRequired('structural: store-tenancy enforced by DeviceAuthGuard (device_id + user_id + store_id triple) and per-entity store filter inside SyncService.pullEntity')
  @ApiOperation({ summary: 'Fetch sync changes (pull)' })
  async pull(
    @Query(new ZodValidationPipe(PullQuerySchema)) req: PullQuery,
    @CurrentDevice() device: DeviceContext,
  ) {
    return this.syncService.pullEntity(
      req.entity,
      req.cursor,
      device,
      req.limit,
    );
  }
}
