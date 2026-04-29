import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { ListUsersQueryDto, type UserResponseDto } from './dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

/**
 * Admin user management endpoints — requires RBAC entity permission on USER.
 *
 * BOUNDARY: This controller handles admin-level operations (list all users,
 * look up any user by iamUserId) that require explicit RBAC permission checks.
 * It is NOT the right place for user self-service actions (read own profile,
 * update own preferences) — those belong in SelfUsersController (/users/:iamUserId).
 *
 * Adding an endpoint here that omits @RequireEntityPermission would leave it
 * admin-URL-scoped but unprotected beyond AuthGuard — always add the decorator.
 */
@ApiTags('Admin / Users')
@Controller('admin/users')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.USER)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Users retrieved successfully')
  @ApiOperation({
    summary: 'List all users',
    description: 'Returns a paginated list of all users. Supports search by name, email, or phone number.',
  })
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    return this.usersService.listUsers(query);
  }

  /**
   * Get user by external identifier. Platform admin read, gated by USER.view entity permission.
   */
  @Get(':iamUserId')
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({
    summary: 'Get a single user by iamUserId',
    description:
      'Looks up a user by their external identifier. Soft-deleted users return 404.',
  })
  @ApiParam({ name: 'iamUserId', description: 'External user identifier' })
  async getUserByIamUserId(
    @Param('iamUserId') iamUserId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.getByIamUserId(iamUserId);
  }
}
