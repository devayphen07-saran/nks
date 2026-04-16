import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityStatusService } from './entity-status.service';
import { AssignStatusDto } from './dto/entity-status.dto';
import type { EntityStatusListResponse } from './dto/entity-status.dto';
import { ApiResponse } from '../../common/utils/api-response';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Entity Status')
@Controller('entity-status')
export class EntityStatusController {
  constructor(private readonly entityStatusService: EntityStatusService) {}

  /**
   * GET /entity-status/:entityCode/public
   * Public — returns active statuses for an entity. Used by consumer apps
   * to populate status dropdowns and render badges.
   */
  @Get(':entityCode/public')
  @Public()
  @ApiOperation({ summary: 'Get active statuses for an entity (public)' })
  async getEntityStatusesPublic(
    @Param('entityCode') entityCode: string,
  ): Promise<ApiResponse<EntityStatusListResponse>> {
    const data =
      await this.entityStatusService.getStatusesForEntity(entityCode);
    return ApiResponse.ok(
      data,
      `Statuses for '${entityCode}' retrieved successfully`,
    );
  }

  /**
   * POST /entity-status/:entityCode
   * SUPER_ADMIN — assign a status to an entity.
   */
  @Post(':entityCode')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a status to an entity (SUPER_ADMIN)' })
  async assignStatus(
    @Param('entityCode') entityCode: string,
    @Body() dto: AssignStatusDto,
  ): Promise<ApiResponse<EntityStatusListResponse>> {
    const data = await this.entityStatusService.assignStatus(entityCode, dto);
    return ApiResponse.ok(data, 'Status assigned successfully');
  }

  /**
   * DELETE /entity-status/:entityCode/:statusGuuid
   * SUPER_ADMIN — remove a status from an entity.
   */
  @Delete(':entityCode/:statusGuuid')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a status from an entity (SUPER_ADMIN)' })
  async removeStatus(
    @Param('entityCode') entityCode: string,
    @Param('statusGuuid') statusGuuid: string,
  ): Promise<void> {
    await this.entityStatusService.removeStatus(entityCode, statusGuuid);
  }
}
