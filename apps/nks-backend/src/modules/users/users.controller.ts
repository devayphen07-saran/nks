import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ApiResponse } from '../../common/utils/api-response';
import { ListUsersQueryDto, ListUsersQuerySchema, type UserResponseDto } from './dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard, RBACGuard)
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
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: ListUsersQueryDto,
  ): Promise<ApiResponse<{ items: UserResponseDto[] }>> {
    const { rows, total } = await this.usersService.listUsers({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    return ApiResponse.paginated(
      rows,
      query.page,
      query.pageSize,
      total,
      'Users retrieved successfully',
    );
  }
}
