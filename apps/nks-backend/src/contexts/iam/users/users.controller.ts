import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { ApiResponse } from '../../../common/utils/api-response';
import { ListUsersQueryDto, type UserResponseDto } from './dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(RBACGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * List all users with optional search and pagination.
   */
  @Get()
  @RequireEntityPermission({ entityCode: EntityCodes.USER, action: PermissionActions.VIEW })
  @ApiOperation({
    summary: 'List all users',
    description:
      'Returns a paginated list of all users. Supports search by name, email, or phone number.',
  })
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<ApiResponse<{ items: UserResponseDto[] }>> {
    const { rows, total } = await this.usersService.listUsers(query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Users retrieved successfully' });
  }
}
