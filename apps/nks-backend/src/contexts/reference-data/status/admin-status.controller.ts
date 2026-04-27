import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StatusQueryService } from './status-query.service';
import { StatusCommandService } from './status-command.service';
import { ParseStatusPipe } from './pipes/parse-status.pipe';
import { CreateStatusDto, UpdateStatusDto, GetAllStatusesQueryDto } from './dto/status.dto';
import type { StatusResponse } from './dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Admin / Statuses')
@Controller('admin/statuses')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.STATUS)
@ApiBearerAuth()
export class AdminStatusController {
  constructor(
    private readonly statusQuery: StatusQueryService,
    private readonly statusCommand: StatusCommandService,
  ) {}

  @Get()
  @RequireEntityPermission({ action: PermissionActions.VIEW, scope: 'PLATFORM' })
  @ResponseMessage('Statuses retrieved successfully')
  @ApiOperation({ summary: 'List all statuses including inactive' })
  async listStatuses(@Query() query: GetAllStatusesQueryDto): Promise<PaginatedResult<StatusResponse>> {
    return this.statusQuery.listStatuses(query);
  }

  @Post()
  @RequireEntityPermission({ action: PermissionActions.CREATE, scope: 'PLATFORM' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Status created successfully')
  @ApiOperation({ summary: 'Create a new status' })
  async createStatus(
    @Body() dto: CreateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<StatusResponse> {
    return this.statusCommand.createStatus(dto, user.userId);
  }

  @Put(':guuid')
  @RequireEntityPermission({ action: PermissionActions.EDIT, scope: 'PLATFORM' })
  @ResponseMessage('Status updated successfully')
  @ApiOperation({ summary: 'Update a status' })
  async updateStatus(
    @Param('guuid', ParseUUIDPipe, ParseStatusPipe) status: Status,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<StatusResponse> {
    return this.statusCommand.updateStatus(status, dto, user.userId);
  }

  @Delete(':guuid')
  @RequireEntityPermission({ action: PermissionActions.DELETE, scope: 'PLATFORM' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a status (system statuses protected)' })
  async deleteStatus(
    @Param('guuid', ParseUUIDPipe, ParseStatusPipe) status: Status,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.statusCommand.deleteStatus(status, user.userId);
  }
}
