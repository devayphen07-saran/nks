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
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import {
  EntityCodes,
  PermissionActions,
} from '../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import type {
  RoleDetailResponse,
  RoleResponseDto,
} from './dto/role-response.dto';
import type { SessionUser } from 'src/modules/auth/interfaces/session-user.interface';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(AuthGuard, RBACGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * POST /roles
   * Create a new custom role.
   * Store ownership is verified in the service.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireEntityPermission({
    entityCode: EntityCodes.ROLE,
    action: PermissionActions.CREATE,
  })
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleResponseDto>> {
    const role = await this.rolesService.createRole(user.userId, dto, user.activeStoreId);
    return ApiResponse.ok(role, 'Role created successfully');
  }

  /**
   * GET /roles/:guuid
   * Get role details with all permissions (entity + route).
   * Store ownership is verified in the service.
   */
  @Get(':guuid')
  @RequireEntityPermission({
    entityCode: EntityCodes.ROLE,
    action: PermissionActions.VIEW,
  })
  @ApiOperation({ summary: 'Get role details with permissions' })
  async getRoleWithPermissions(
    @Param('guuid') guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleDetailResponse>> {
    const roleDetail = await this.rolesService.getRoleWithPermissions(
      guuid,
      user.activeStoreId,
    );
    return ApiResponse.ok(roleDetail, 'Role retrieved successfully');
  }

  /**
   * PUT /roles/:guuid
   * Update role and its permissions.
   * Store ownership is verified in the service.
   */
  @Put(':guuid')
  @RequireEntityPermission({
    entityCode: EntityCodes.ROLE,
    action: PermissionActions.EDIT,
  })
  @ApiOperation({ summary: 'Update role and permissions' })
  async updateRole(
    @Param('guuid') guuid: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<RoleResponseDto>> {
    const role = await this.rolesService.updateRoleByGuuid(
      user.userId,
      guuid,
      dto,
      user.activeStoreId,
    );
    return ApiResponse.ok(role, 'Role updated successfully');
  }
}
