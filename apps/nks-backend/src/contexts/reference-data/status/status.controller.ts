import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StatusService } from './status.service';
import { AuditService } from '../../compliance/audit/audit.service';
import { CreateStatusDto, UpdateStatusDto, GetAllStatusesQueryDto } from './dto/status.dto';
import type { StatusListResponse, StatusSingleResponse } from './dto/status.dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { Public } from '../../../common/decorators/public.decorator';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';

@ApiTags('Status')
@Controller('statuses')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /statuses
   * Public — returns all active statuses for badge rendering in consumer apps.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active statuses (public)' })
  async getActiveStatuses(): Promise<ApiResponse<StatusListResponse>> {
    const data = await this.statusService.getActiveStatuses();
    return ApiResponse.ok(data, 'Statuses retrieved successfully');
  }

  /**
   * GET /statuses/all
   * Returns all statuses including inactive, with optional search.
   */
  @Get('all')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all statuses including inactive' })
  async listStatuses(
    @Query() query: GetAllStatusesQueryDto,
  ): Promise<ApiResponse<{ items: StatusListResponse }>> {
    const { rows, total } = await this.statusService.listStatuses(query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Statuses retrieved successfully' });
  }

  /**
   * POST /statuses
   * Create a new status with visual styling.
   */
  @Post()
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.CREATE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new status' })
  async createStatus(
    @Body() dto: CreateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StatusSingleResponse>> {
    const data = await this.statusService.createStatus(dto, user.userId);
    this.auditService.logStatusCreated(user.userId, data.guuid, data.code);
    return ApiResponse.ok(data, 'Status created successfully');
  }

  /**
   * PUT /statuses/:guuid
   * Update name, colors, bold, active flag. Code is immutable.
   */
  @Put(':guuid')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.EDIT })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a status' })
  async updateStatus(
    @Param('guuid') guuid: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StatusSingleResponse>> {
    const data = await this.statusService.updateStatus(guuid, dto, user.userId);
    this.auditService.logStatusUpdated(user.userId, data.guuid, data.code, { ...dto });
    return ApiResponse.ok(data, 'Status updated successfully');
  }

  /**
   * DELETE /statuses/:guuid
   * Soft delete. Blocked for isSystem = true statuses.
   */
  @Delete(':guuid')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.DELETE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a status (system statuses protected)' })
  async deleteStatus(
    @Param('guuid') guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.statusService.deleteStatus(guuid, user.userId);
    this.auditService.logStatusDeleted(user.userId, guuid, guuid);
  }
}
