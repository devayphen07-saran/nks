import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { CreateRoleDto, UpdateRoleDto, ListRolesQueryDto } from './dto';
import type { RoleDetailResponse, RoleResponseDto } from './dto/role-response.dto';
import type { SessionUser } from '../auth/interfaces/session-user.interface';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.ROLE)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequireEntityPermission({ action: PermissionActions.VIEW })
  @ResponseMessage('Roles retrieved successfully')
  @ApiOperation({ summary: 'List all roles' })
  async listRoles(
    @Query() query: ListRolesQueryDto,
    @CurrentUser() user: SessionUser,
  ): Promise<PaginatedResult<RoleResponseDto>> {
    return this.rolesService.listRoles({
      page: query.page,
      pageSize: query.pageSize,
      storeId: user.activeStoreId,
      isSuperAdmin: user.isSuperAdmin,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      isActive: query.isActive,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireEntityPermission({ action: PermissionActions.CREATE })
  @ResponseMessage('Role created successfully')
  @ApiOperation({ summary: 'Create a new role' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<RoleResponseDto> {
    return this.rolesService.createRole(user.userId, dto, user.activeStoreId);
  }

  @Get(':guuid')
  @RequireEntityPermission({ action: PermissionActions.VIEW })
  @ResponseMessage('Role retrieved successfully')
  @ApiOperation({ summary: 'Get role details with permissions' })
  async getRoleWithPermissions(
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<RoleDetailResponse> {
    return this.rolesService.getRoleWithPermissions(guuid, user.activeStoreId);
  }

  @Put(':guuid')
  @RequireEntityPermission({ action: PermissionActions.EDIT })
  @ResponseMessage('Role updated successfully')
  @ApiOperation({ summary: 'Update role and permissions' })
  async updateRole(
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: SessionUser,
  ): Promise<RoleResponseDto> {
    return this.rolesService.updateRoleByGuuid(user.userId, guuid, dto, user.activeStoreId);
  }
}
