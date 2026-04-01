import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminMapper } from './mapper';
import {
  adminPaginationSchema,
  updateAdminUserSchema,
  updateAdminStoreSchema,
  type AdminPaginationInput,
  type UpdateAdminUserInput,
  type UpdateAdminStoreInput,
} from './admin.schemas';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RBACGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ──── Users Management ────

  /**
   * GET /api/admin/users
   * List all users with pagination and search
   */
  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination and search' })
  @SwaggerResponse({
    status: 200,
    description: 'Users fetched successfully',
  })
  async listUsers(
    @Query(new ZodValidationPipe(adminPaginationSchema))
    query: AdminPaginationInput,
  ) {
    const result = await this.adminService.listUsers(query);
    return ApiResponse.ok(
      {
        data: AdminMapper.toUserResponseDtoArray(result.data),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
      'Users fetched successfully',
    );
  }

  /**
   * GET /api/admin/users/:userId
   * Get a single user by ID
   */
  @Get('users/:userId')
  @ApiOperation({ summary: 'Get user details by ID' })
  @SwaggerResponse({
    status: 200,
    description: 'User fetched successfully',
  })
  async getUser(@Param('userId', ParseIntPipe) userId: number) {
    const user = await this.adminService.getUserById(userId);
    return ApiResponse.ok(
      AdminMapper.toUserResponseDto(user),
      'User fetched successfully',
    );
  }

  /**
   * PATCH /api/admin/users/:userId
   * Update user details (name, verification status, block status)
   */
  @Patch('users/:userId')
  @ApiOperation({ summary: 'Update user details' })
  @SwaggerResponse({
    status: 200,
    description: 'User updated successfully',
  })
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ZodValidationPipe(updateAdminUserSchema))
    dto: UpdateAdminUserInput,
  ) {
    const updated = await this.adminService.updateUser(userId, dto);
    return ApiResponse.ok(
      AdminMapper.toUserResponseDto(updated),
      'User updated successfully',
    );
  }

  // ──── Stores Management ────

  /**
   * GET /api/admin/stores
   * List all stores with pagination and search
   */
  @Get('stores')
  @ApiOperation({ summary: 'List all stores with pagination and search' })
  @SwaggerResponse({
    status: 200,
    description: 'Stores fetched successfully',
  })
  async listStores(
    @Query(new ZodValidationPipe(adminPaginationSchema))
    query: AdminPaginationInput,
  ) {
    const result = await this.adminService.listStores(query);
    return ApiResponse.ok(
      {
        data: AdminMapper.toStoreResponseDtoArray(result.data),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
      'Stores fetched successfully',
    );
  }

  /**
   * GET /api/admin/stores/:storeId
   * Get a single store by ID
   */
  @Get('stores/:storeId')
  @ApiOperation({ summary: 'Get store details by ID' })
  @SwaggerResponse({
    status: 200,
    description: 'Store fetched successfully',
  })
  async getStore(@Param('storeId', ParseIntPipe) storeId: number) {
    const store = await this.adminService.getStoreById(storeId);
    return ApiResponse.ok(
      AdminMapper.toStoreResponseDto(store),
      'Store fetched successfully',
    );
  }

  /**
   * PATCH /api/admin/stores/:storeId
   * Update store details
   */
  @Patch('stores/:storeId')
  @ApiOperation({ summary: 'Update store details' })
  @SwaggerResponse({
    status: 200,
    description: 'Store updated successfully',
  })
  async updateStore(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body(new ZodValidationPipe(updateAdminStoreSchema))
    dto: UpdateAdminStoreInput,
  ) {
    const updated = await this.adminService.updateStore(storeId, dto);
    return ApiResponse.ok(
      AdminMapper.toStoreResponseDto(updated),
      'Store updated successfully',
    );
  }
}
