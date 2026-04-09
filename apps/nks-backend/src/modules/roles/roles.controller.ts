import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiResponse } from '../../common/utils/api-response';
import { RolesService } from './roles.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import type { RoleDetailResponse, RoleResponse, RoleResponseDto } from './dto/role-response.dto';
import type { SessionUser } from 'src/modules/auth/interfaces/session-user.interface';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(AuthGuard, RBACGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * POST /roles
   * Create a new custom role
   * Only STORE_OWNER can create roles, and only in stores they own
   * Store ownership is verified in the service
   */
  @Post()
  @Roles('STORE_OWNER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role (STORE_OWNER)' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleResponseDto>> {
    const role = await this.rolesService.createRole(user.userId, dto);
    return ApiResponse.ok(role, 'Role created successfully');
  }

  /**
   * GET /roles/:id
   * Get role details with all permissions (entity + route)
   * Only STORE_OWNER can view roles, and only roles from their own store
   * Store ownership is verified in the service
   */
  @Get(':guuid')
  @Roles('STORE_OWNER')
  @ApiOperation({ summary: 'Get role details with permissions (STORE_OWNER)' })
  async getRoleWithPermissions(
    @Param('guuid') guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleDetailResponse>> {
    const roleDetail = await this.rolesService.getRoleWithPermissions(
      guuid,
      user.userId,
    );
    return ApiResponse.ok(roleDetail, 'Role retrieved successfully');
  }

  /**
   * PUT /roles/:id
   * Update role and its permissions
   * Only STORE_OWNER can update roles, and only roles from their own store
   * Store ownership is verified in the service
   */
  @Put(':guuid')
  @Roles('STORE_OWNER')
  @ApiOperation({ summary: 'Update role and permissions (STORE_OWNER)' })
  async updateRole(
    @Param('guuid') guuid: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleResponseDto>> {
    const role = await this.rolesService.updateRoleByGuuid(
      guuid,
      dto,
      user.userId,
    );

    if (
      dto.entityPermissions &&
      Object.keys(dto.entityPermissions).length > 0
    ) {
      await this.rolesService.updateEntityPermissions(
        role.id,
        dto.entityPermissions,
      );
    }

    return ApiResponse.ok(role, 'Role updated successfully');
  }
}
