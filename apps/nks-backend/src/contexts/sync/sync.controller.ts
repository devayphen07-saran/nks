import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { ApiResponse } from '../../common/utils/api-response';
import { SyncService, type ChangesResponse } from './sync.service';
import {
  SyncPushDto,
  SyncChangesQueryDto,
} from './dto/requests';

@ApiTags('Sync')
@Controller('sync')
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /sync/changes
   * Fetches data changes since a cursor timestamp for pull-based offline sync.
   * Paginates through routes table changes, returning up to 500 rows per request.
   * Validates user membership in the requested store.
   */
  @Get('changes')
  @ApiOperation({
    summary: 'Fetch sync changes since cursor',
    description:
      'Returns paginated list of changed rows for offline-first sync. Mobile polls this endpoint, applies changes locally, and stores the nextCursor.',
  })
  async getChanges(
    @Req() req: AuthenticatedRequest,
    @Query() query: SyncChangesQueryDto,
  ): Promise<ApiResponse<ChangesResponse>> {
    const result = await this.syncService.getChanges(
      req.user.userId,
      query.cursor,
      query.storeId,
      query.tables,
      query.limit,
    );

    return ApiResponse.ok(result, 'Sync changes fetched');
  }

  /**
   * POST /sync/push
   * Receives batched sync operations from mobile.
   * Each operation is deduplicated via idempotency key and wrapped
   * in a transaction with field-level conflict resolution.
   *
   * Authorization: requires SYNC entity CREATE permission (DB-driven).
   * Store membership + offline session validated inside the service.
   */
  @Post('push')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.SYNC, action: PermissionActions.CREATE })
  @ApiOperation({
    summary: 'Push offline mutations from mobile',
    description:
      'Receives batched sync operations from mobile upload queue. Deduplicated via idempotency key, wrapped in transaction.',
  })
  async syncPush(
    @Req() req: AuthenticatedRequest,
    @Body() body: SyncPushDto,
  ): Promise<ApiResponse<{ processed: number; rejected: number; status: 'ok' | 'partial' }>> {
    const result = await this.syncService.processPushBatch(
      body.operations,
      req.user.userId,
      req.user.activeStoreId,
      body.offlineSession,
    );

    return ApiResponse.ok(result, 'Sync push processed');
  }
}
