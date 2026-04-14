import {
  Controller,
  Post,
  Get,
  Req,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/utils/api-response';
import { SyncService, type ChangesResponse } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /sync/changes
   * Fetches data changes since a cursor timestamp for pull-based offline sync.
   * Paginates through routes table changes, returning up to 500 rows per request.
   * Validates user membership in the requested store.
   *
   * Query parameters:
   *   cursor: number (default 0) — millisecond epoch timestamp of last sync
   *   storeId: string (required) — store GUUID to sync for
   *   Note: currently only 'routes' table is supported. Future tables (products, orders) will extend this endpoint.
   */
  @Get('changes')
  @ApiOperation({
    summary: 'Fetch sync changes since cursor',
    description:
      'Returns paginated list of changed rows for offline-first sync. Mobile polls this endpoint, applies changes locally, and stores the nextCursor.',
  })
  async getChanges(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursorStr?: string,
    @Query('storeId') storeGuuid?: string,
  ): Promise<ApiResponse<ChangesResponse>> {
    const user = req.user;

    if (!storeGuuid || typeof storeGuuid !== 'string') {
      throw new BadRequestException('storeId query parameter is required');
    }

    let cursor = 0;
    if (cursorStr) {
      const parsed = parseInt(cursorStr, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new BadRequestException('cursor must be a non-negative number');
      }
      cursor = parsed;
    }

    const result = await this.syncService.getChanges(
      user.userId,
      cursor,
      storeGuuid,
    );

    return ApiResponse.ok(result, 'Sync changes fetched');
  }

  /**
   * POST /sync/push
   * Receives batched sync operations from mobile.
   * Each operation is deduplicated via idempotency key and wrapped
   * in a transaction with field-level conflict resolution.
   *
   * Request body: { operations: Array<{ id, clientId, table, op, opData }> }
   * Returns: { processed: number }
   */
  @Post('push')
  @UseGuards(RBACGuard)
  @Roles('CASHIER', 'MANAGER', 'STORE_OWNER')
  @ApiOperation({
    summary: 'Push offline mutations from mobile',
    description:
      'Receives batched sync operations from mobile upload queue. Deduplicated via idempotency key, wrapped in transaction.',
  })
  async syncPush(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<{ processed: number }>> {
    const user = req.user;
    const operations: any[] = req.body?.operations ?? [];

    if (!Array.isArray(operations)) {
      throw new BadRequestException('operations must be an array');
    }

    const result = await this.syncService.processPushBatch(
      operations,
      user.userId,
      user.activeStoreId,
    );

    return ApiResponse.ok(result, 'Sync push processed');
  }
}
