import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Query,
  Req,
  UseGuards,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../common/decorators/entity-resource.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { SyncService, type ChangesResponse, type PushResponse } from './sync.service';
import {
  SyncPushDto,
  SyncChangesQueryDto,
} from './dto/requests';
import {
  SUPPORTED_SYNC_SCHEMA_VERSIONS,
  SYNC_SCHEMA_VERSION_HEADER,
} from './sync.constants';

@ApiTags('Sync')
@Controller('sync')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.SYNC)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  private assertSchemaVersion(version: string | undefined): void {
    const v = version?.trim() ?? '';
    if (!SUPPORTED_SYNC_SCHEMA_VERSIONS.has(v)) {
      throw new ConflictException(
        `Unsupported sync schema version "${v}". ` +
        `Supported: [${[...SUPPORTED_SYNC_SCHEMA_VERSIONS].join(', ')}]. Please update the app.`,
      );
    }
  }

  @Get('changes')
  @RateLimit(60)
  @RequireEntityPermission({ action: PermissionActions.VIEW })
  @ResponseMessage('Sync changes fetched')
  @ApiOperation({
    summary: 'Fetch sync changes since cursor',
    description:
      'Returns paginated list of changed rows for offline-first sync. Mobile polls this endpoint, applies changes locally, and stores the nextCursors.',
  })
  async getChanges(
    @Req() req: AuthenticatedRequest,
    @Query() query: SyncChangesQueryDto,
    @Headers(SYNC_SCHEMA_VERSION_HEADER) schemaVersion: string | undefined,
  ): Promise<ChangesResponse> {
    this.assertSchemaVersion(schemaVersion);
    return this.syncService.getChanges({
      userId: req.user.userId,
      sessionActiveStoreId: req.user.activeStoreId,
      cursors: query.cursor,
      storeGuuid: query.storeGuuid,
      tablesCsv: query.tables,
      limit: query.limit,
    });
  }

  @Post('push')
  @RateLimit(30)
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
    @Headers(SYNC_SCHEMA_VERSION_HEADER) schemaVersion: string | undefined,
  ): Promise<PushResponse> {
    this.assertSchemaVersion(schemaVersion);
    return this.syncService.processPushBatch(
      body.operations,
      req.user.userId,
      req.user.activeStoreId,
      body.offlineSession,
    );
  }
}
