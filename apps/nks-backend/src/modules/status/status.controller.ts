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
import { CreateStatusDto, UpdateStatusDto, GetAllStatusesQuerySchema, GetAllStatusesQueryDto } from './dto/status.dto';
import type { StatusListResponse, StatusSingleResponse } from './dto/status.dto';
import { ApiResponse } from '../../common/utils/api-response';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

@ApiTags('Status')
@Controller('statuses')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

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
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all statuses including inactive' })
  async getAllStatuses(
    @Query(new ZodValidationPipe(GetAllStatusesQuerySchema)) query: GetAllStatusesQueryDto,
  ): Promise<ApiResponse<StatusListResponse>> {
    const data = await this.statusService.getAllStatuses(query.search);
    return ApiResponse.ok(data, 'Statuses retrieved successfully');
  }

  /**
   * POST /statuses
   * Create a new status with visual styling.
   */
  @Post()
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.CREATE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new status' })
  async createStatus(
    @Body() dto: CreateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StatusSingleResponse>> {
    const data = await this.statusService.createStatus(dto, user.userId);
    return ApiResponse.ok(data, 'Status created successfully');
  }

  /**
   * PUT /statuses/:guuid
   * Update name, colors, bold, active flag. Code is immutable.
   */
  @Put(':guuid')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.EDIT })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a status' })
  async updateStatus(
    @Param('guuid') guuid: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StatusSingleResponse>> {
    const data = await this.statusService.updateStatus(guuid, dto, user.userId);
    return ApiResponse.ok(data, 'Status updated successfully');
  }

  /**
   * DELETE /statuses/:guuid
   * Soft delete. Blocked for isSystem = true statuses.
   */
  @Delete(':guuid')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.DELETE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a status (system statuses protected)' })
  async deleteStatus(
    @Param('guuid') guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.statusService.deleteStatus(guuid, user.userId);
  }
}
