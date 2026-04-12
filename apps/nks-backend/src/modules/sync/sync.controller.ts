import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { ApiResponse } from '../../common/utils/api-response';
import { SyncService } from './sync.service';

type Db = NodePgDatabase<typeof schema>;

@ApiTags('Sync')
@Controller('sync')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly syncService: SyncService,
  ) {}

  /**
   * POST /sync/push
   * Receives batched sync operations from PowerSync.
   * Each operation is deduplicated via idempotency key and wrapped
   * in a transaction with field-level conflict resolution.
   *
   * Reference: MOBILE_OFFLINE_FLOW.md Section 16
   */
  @Post('push')
  @ApiOperation({
    summary: 'Push offline mutations from mobile',
    description:
      'Receives batched sync operations from PowerSync upload queue. Deduplicated via idempotency key, wrapped in transaction.',
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

  /**
   * GET /sync/powersync-token
   * Issues a short-lived JWT for PowerSync service authentication.
   * PowerSync requires its own JWT with a specific audience.
   *
   * Reference: MOBILE_OFFLINE_FLOW.md Section 16
   */
  @Get('powersync-token')
  @ApiOperation({
    summary: 'Get PowerSync authentication token',
    description:
      'Returns a 5-minute RS256 JWT for PowerSync service. Called by the mobile PowerSync connector.',
  })
  async getPowerSyncToken(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<{ token: string; expiresAt: number }>> {
    const user = req.user;

    const result = await this.syncService.generatePowerSyncToken(
      user.guuid,
      user.email,
    );

    return ApiResponse.ok(result, 'PowerSync token issued');
  }
}
