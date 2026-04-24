import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { StoreRoutesResponseDto } from './dto/route-response.dto';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

@ApiTags('Routes')
@Controller('routes')
@UseGuards(RBACGuard)
@ApiBearerAuth()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('store/:storeGuuid')
  @RequireEntityPermission({ entityCode: EntityCodes.ROUTE, action: PermissionActions.VIEW })
  @ResponseMessage('Store routes retrieved successfully')
  @ApiOperation({ summary: 'Get store routes for authenticated user' })
  async getStoreRoutes(
    @Param('storeGuuid', ParseUUIDPipe) storeGuuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<StoreRoutesResponseDto> {
    return this.routesService.getStoreRoutesByGuuid(user, storeGuuid);
  }
}
