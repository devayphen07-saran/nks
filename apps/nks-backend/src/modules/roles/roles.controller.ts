import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignPermissionDto,
  AssignRoleDto,
  RoleResponseDto,
  PermissionResponseDto,
} from './dto';
import { RoleMapper, PermissionMapper } from './mapper';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(AuthGuard, RBACGuard)
@Roles('SUPER_ADMIN')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ─── Roles ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List active roles with optional search and pagination',
  })
  @SwaggerResponse({
    type: [RoleResponseDto],
    status: 200,
    description: 'Roles listed',
  })
  async listRoles(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.rolesService.listRoles({
      search,
      page,
      pageSize,
    });
    return ApiResponse.ok(
      {
        items: result.rows.map((r) => RoleMapper.toResponseDto(r)),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      'Roles retrieved',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  @SwaggerResponse({ type: RoleResponseDto, status: 200 })
  async getRole(@Param('id', ParseIntPipe) id: number) {
    const role = await this.rolesService.getRole(id);
    return ApiResponse.ok(RoleMapper.toResponseDto(role));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @SwaggerResponse({
    type: RoleResponseDto,
    status: 201,
    description: 'Role created',
  })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser('userId') userId: number,
  ) {
    const role = await this.rolesService.createRole(dto, userId);
    return ApiResponse.ok(RoleMapper.toResponseDto(role), 'Role created');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role (system roles are immutable)' })
  @SwaggerResponse({ type: RoleResponseDto, status: 200 })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('userId') userId: number,
  ) {
    const role = await this.rolesService.updateRole(id, dto, userId);
    return ApiResponse.ok(RoleMapper.toResponseDto(role), 'Role updated');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a role (system roles are immutable)' })
  async deleteRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    await this.rolesService.deleteRole(id, userId);
    return ApiResponse.ok(null, 'Role deleted');
  }

  // ─── Role ↔ Permission Management ────────────────────────────────────────

  @Get(':id/permissions')
  @ApiOperation({ summary: 'List all permissions assigned to a role' })
  @SwaggerResponse({ type: [PermissionResponseDto] })
  async getRolePermissions(@Param('id', ParseIntPipe) id: number) {
    const perms = await this.rolesService.getRolePermissions(id);
    const mapped = perms.map((p) =>
      PermissionMapper.toResponseDto(p.permission),
    );
    return ApiResponse.ok(mapped);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Assign a permission to a role' })
  async assignPermission(
    @Param('id', ParseIntPipe) roleId: number,
    @Body() dto: AssignPermissionDto,
    @CurrentUser('userId') userId: number,
  ) {
    await this.rolesService.assignPermissionToRole(
      roleId,
      dto.permissionId,
      userId,
    );
    return ApiResponse.ok(null, 'Permission assigned');
  }

  @Delete(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Revoke a permission from a role' })
  async revokePermission(
    @Param('id', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    await this.rolesService.revokePermissionFromRole(roleId, permissionId);
    return ApiResponse.ok(null, 'Permission revoked');
  }

  // ─── User ↔ Role Assignment ───────────────────────────────────────────────

  @Post('assign-user')
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRoleToUser(
    @Body() dto: AssignRoleDto,
    @CurrentUser('userId') userId: number,
  ) {
    await this.rolesService.assignRoleToUser(dto.userId, dto.roleId, userId);
    return ApiResponse.ok(null, 'Role assigned to user');
  }

  @Delete('revoke-user')
  @ApiOperation({ summary: 'Revoke a role from a user' })
  async revokeRoleFromUser(
    @Body() dto: AssignRoleDto,
    @CurrentUser('userId') userId: number,
  ) {
    await this.rolesService.revokeRoleFromUser(dto.userId, dto.roleId, userId);
    return ApiResponse.ok(null, 'Role revoked from user');
  }

  // ─── Permission Management ────────────────────────────────────────────────

  @Get('permissions/all')
  @ApiOperation({
    summary:
      'List all permissions (optionally filter by resource, e.g. users, company)',
  })
  @SwaggerResponse({ type: [PermissionResponseDto] })
  async listPermissions(@Query('resource') resource?: string) {
    const perms = await this.rolesService.listPermissions(resource);
    const mapped = perms.map((p) => PermissionMapper.toResponseDto(p));
    return ApiResponse.ok(mapped);
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create a new permission' })
  @SwaggerResponse({ type: PermissionResponseDto })
  async createPermission(@Body() dto: CreatePermissionDto) {
    const perm = await this.rolesService.createPermission(dto);
    return ApiResponse.ok(
      PermissionMapper.toResponseDto(perm),
      'Permission created',
    );
  }

  // ─── User Permission Checking ─────────────────────────────────────────────

  @Get('users/:userId/permissions')
  @ApiOperation({ summary: 'Get all permissions for a user' })
  @SwaggerResponse({ type: [PermissionResponseDto] })
  async getUserPermissions(@Param('userId', ParseIntPipe) userId: number) {
    const permissions = await this.rolesService.getUserPermissions(userId);
    return ApiResponse.ok(permissions, 'User permissions retrieved');
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'Get all roles assigned to a user' })
  getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    // Get user roles - will be implemented in service
    // For now return empty array with proper structure
    return ApiResponse.ok({ roles: [], userId }, 'User roles retrieved');
  }

  @Post('users/:userId/roles')
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRoleToUserByPath(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: { roleId: number; storeId?: number },
    @CurrentUser('userId') currentUserId: number,
  ) {
    await this.rolesService.assignRoleToUser(userId, dto.roleId, currentUserId);
    return ApiResponse.ok(null, 'Role assigned to user');
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Revoke a role from a user (hard delete)' })
  async revokeRoleFromUserByPath(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser('userId') currentUserId: number,
  ) {
    await this.rolesService.revokeRoleFromUser(userId, roleId, currentUserId);
    return ApiResponse.ok(null, 'Role revoked from user');
  }

  @Patch('users/:userId/roles/:roleId/suspend')
  @ApiOperation({
    summary: 'Suspend a user role (keeps audit trail, isActive=false)',
  })
  async suspendUserRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    await this.rolesService.suspendUserRole(userId, roleId);
    return ApiResponse.ok(null, 'Role suspended');
  }

  @Patch('users/:userId/roles/:roleId/restore')
  @ApiOperation({ summary: 'Restore a previously suspended user role' })
  async restoreUserRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    await this.rolesService.restoreUserRole(userId, roleId);
    return ApiResponse.ok(null, 'Role restored');
  }

  @Get('users/:userId/has-permission')
  @ApiOperation({ summary: 'Check if user has specific permission' })
  async checkUserPermission(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('resource') resource: string,
    @Query('action') action: string,
  ) {
    const hasPermission = await this.rolesService.checkUserPermission(
      userId,
      resource,
      action,
    );

    return ApiResponse.ok(
      { hasPermission, resource, action, userId },
      'Permission check completed',
    );
  }

  @Get('users/:userId/is-super-admin')
  @ApiOperation({ summary: 'Check if user is super admin' })
  async checkIsSuperAdmin(@Param('userId', ParseIntPipe) userId: number) {
    const isSuperAdmin = await this.rolesService.isSuperAdmin(userId);
    return ApiResponse.ok(
      { isSuperAdmin, userId },
      'Super admin check completed',
    );
  }
}
