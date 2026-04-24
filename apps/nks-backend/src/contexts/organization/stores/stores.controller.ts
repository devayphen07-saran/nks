import { Controller, Get, Put, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService, StoreDto } from './stores.service';
import { SetDefaultStoreDto } from './dto/set-default-store.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { NoEntityPermissionRequired } from '../../../common/decorators/no-entity-permission-required.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';

@ApiTags('Stores')
@Controller('stores')
@ApiBearerAuth()
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('me')
  @NoEntityPermissionRequired('self-service: user reading only their own store memberships')
  @ResponseMessage('Stores retrieved successfully')
  @ApiOperation({
    summary: 'Get stores for authenticated user',
    description:
      'Returns owned stores (myStores) and staff stores (invitedStores) for the current user.',
  })
  async getMyStores(
    @CurrentUser() user: SessionUser,
  ): Promise<{ myStores: StoreDto[]; invitedStores: StoreDto[] }> {
    return this.storesService.getMyStores(user.userId);
  }

  @Put('default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @NoEntityPermissionRequired('structural: membership enforced inside StoresService.setDefaultStoreIfMember via atomic EXISTS subquery')
  @ApiOperation({
    summary: 'Set default store',
    description: 'Sets the default store for the authenticated user. Only one default at a time.',
  })
  async setDefaultStore(
    @Body() body: SetDefaultStoreDto,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.storesService.setDefaultStore(user.userId, body.storeGuuid);
  }
}
