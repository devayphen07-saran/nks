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
import { EntityResource } from '../../common/decorators/entity-resource.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { SyncService, type ChangesResponse } from './sync.service';
import {
  SyncPushDto,
  SyncChangesQueryDto,
} from './dto/requests';

@ApiTags('Sync')
@Controller('sync')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.SYNC)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('changes')
  @RequireEntityPermission({ action: PermissionActions.VIEW })
  @ResponseMessage('Sync changes fetched')
  @ApiOperation({
    summary: 'Fetch sync changes since cursor',
    description:
      'Returns paginated list of changed rows for offline-first sync. Mobile polls this endpoint, applies changes locally, and stores the nextCursor.',
  })
  async getChanges(
    @Req() req: AuthenticatedRequest,
    @Query() query: SyncChangesQueryDto,
  ): Promise<ChangesResponse> {
    return this.syncService.getChanges({
      userId: req.user.userId,
      cursor: query.cursor,
      storeGuuid: query.storeGuuid,
      tablesCsv: query.tables,
      limit: query.limit,
    });
  }

  @Post('push')
  @RequireEntityPermission({ action: PermissionActions.CREATE })
  @ResponseMessage('Sync push processed')
  @ApiOperation({
    summary: 'Push offline mutations from mobile',
    description:
      'Receives batched sync operations from mobile upload queue. Deduplicated via idempotency key, wrapped in transaction.',
  })
  async syncPush(
    @Req() req: AuthenticatedRequest,
    @Body() body: SyncPushDto,
  ): Promise<{ processed: number; rejected: number; status: 'ok' | 'partial' }> {
    return this.syncService.processPushBatch(
      body.operations,
      req.user.userId,
      req.user.activeStoreId,
      body.offlineSession,
    );
  }
}
