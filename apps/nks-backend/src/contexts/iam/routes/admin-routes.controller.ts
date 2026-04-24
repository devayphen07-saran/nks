import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { UserRoutesResponseDto } from './dto/route-response.dto';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

@ApiTags('Admin / Routes')
@Controller('admin/routes')
@UseGuards(RBACGuard)
@ApiBearerAuth()
export class AdminRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @RequireEntityPermission({
    entityCode: EntityCodes.ROUTE,
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Admin routes retrieved successfully')
  @ApiOperation({ summary: 'Get admin routes' })
  async getAdminRoutes(
    @CurrentUser() caller: SessionUser,
  ): Promise<UserRoutesResponseDto> {
    return this.routesService.getAdminRoutes(caller);
  }
}
