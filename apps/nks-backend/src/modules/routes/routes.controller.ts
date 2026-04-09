import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { RouteMapper } from './mapper/route.mapper';
import { ApiResponse } from '../../common/utils/api-response';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  UserRoutesResponseDto,
  StoreRoutesResponseDto,
} from './dto/route-response.dto';
import type { SessionUser } from 'src/modules/auth/interfaces/session-user.interface';

@ApiTags('Routes')
@Controller('routes')
@UseGuards(AuthGuard, RBACGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  /**
   * GET /routes/admin
   * Returns admin routes for the authenticated SUPER_ADMIN.
   * RBACGuard enforces the SUPER_ADMIN role before this method runs.
   * Identity comes from the session — no path param needed.
   */
  @Get('admin')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get admin routes (SUPER_ADMIN)' })
  async getAdminRoutes(
    @CurrentUser() caller: SessionUser,
  ): Promise<ApiResponse<UserRoutesResponseDto>> {
    const result = await this.routesService.getAdminRoutes(caller.userId);
    const response = RouteMapper.toUserRoutesResponse(caller, result.routes);
    return ApiResponse.ok(response, 'Admin routes retrieved successfully');
  }

  /**
   * GET /routes/store/:storeId
   * Returns store routes for the calling user in the given store.
   * Available to any authenticated user who has a role in that store.
   */
  @Get('store/:storeGuuid')
  @ApiOperation({ summary: 'Get store routes for authenticated user' })
  async getStoreRoutes(
    @Param('storeGuuid') storeGuuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StoreRoutesResponseDto>> {
    const result = await this.routesService.getStoreRoutesByGuuid(
      user.userId,
      storeGuuid,
    );

    // Record-Level Security: If no routes returned, user doesn't have access
    if (result.routes.length === 0) {
      throw new ForbiddenException({
        message: 'You do not have access to this store or it does not exist.',
      });
    }

    const response = RouteMapper.toStoreRoutesResponse(user, result.routes);
    return ApiResponse.ok(response, 'Store routes retrieved successfully');
  }
}
