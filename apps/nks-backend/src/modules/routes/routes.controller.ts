import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Routes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get routes for current user based on their roles' })
  async getUserRoutes(@CurrentUser('userId') userId: number) {
    const routes = await this.routesService.getUserRoutes(userId);
    return ApiResponse.ok(routes, 'User routes retrieved');
  }

  @Get('admin')
  @UseGuards(RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all admin routes' })
  async getAdminRoutes() {
    const routes = await this.routesService.getAdminRoutes();
    return ApiResponse.ok(routes, 'Admin routes retrieved');
  }

  @Get('admin/permissions')
  @UseGuards(RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all admin permissions' })
  async getAdminPermissions() {
    const permissions = await this.routesService.getAdminPermissions();
    return ApiResponse.ok(permissions, 'Admin permissions retrieved');
  }

  @Get('admin/combined')
  @UseGuards(RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get admin routes and permissions combined' })
  async getAdminRoutesAndPermissions() {
    const data = await this.routesService.getAdminRoutesAndPermissions();
    return ApiResponse.ok(data, 'Admin routes and permissions retrieved');
  }
}
