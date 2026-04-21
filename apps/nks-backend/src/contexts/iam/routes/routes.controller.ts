import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { RouteMapper } from './mapper/route.mapper';
import { ApiResponse } from '../../../common/utils/api-response';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  UserRoutesResponseDto,
  StoreRoutesResponseDto,
} from './dto/route-response.dto';
import type { SessionUser } from 'src/contexts/iam/auth/interfaces/session-user.interface';

@ApiTags('Routes')
@Controller('routes')
@UseGuards(RBACGuard)
@ApiBearerAuth()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  /**
   * GET /routes/admin
   * Returns admin routes for the authenticated user.
   * RBACGuard enforces entity permission before this method runs.
   * Identity comes from the session — no path param needed.
   */
  @Get('admin')
  @RequireEntityPermission({ entityCode: EntityCodes.ROUTE, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'Get admin routes' })
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
  @RequireEntityPermission({ entityCode: EntityCodes.ROUTE, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'Get store routes for authenticated user' })
  async getStoreRoutes(
    @Param('storeGuuid') storeGuuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<StoreRoutesResponseDto>> {
    const result = await this.routesService.getStoreRoutesByGuuid(
      user.userId,
      storeGuuid,
    );
    const response = RouteMapper.toStoreRoutesResponse(user, result.routes);
    return ApiResponse.ok(response, 'Store routes retrieved successfully');
  }
}
