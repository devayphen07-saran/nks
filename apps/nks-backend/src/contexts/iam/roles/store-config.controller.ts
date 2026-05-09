import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreConfigService, type StoreConfig } from './store-config.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { NoEntityPermissionRequired } from '../../../common/decorators/no-entity-permission-required.decorator';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

/**
 * StoreConfigController
 *
 * Hosts `GET /stores/:storeGuuid/config`. Lives in RolesModule (not
 * StoresModule) because the response needs role/permission data, and
 * StoresModule sits below RolesModule in the module dependency chain
 * (AuthModule → RolesModule → StoresModule). The URL path is independent
 * of the module location.
 */
@ApiTags('Stores')
@Controller('stores')
@ApiBearerAuth()
export class StoreConfigController {
  constructor(private readonly storeConfig: StoreConfigService) {}

  @Get(':storeGuuid/config')
  @NoEntityPermissionRequired(
    'self-service: caller reads only their own role/permission snapshot for a store they belong to',
  )
  @ResponseMessage('Store config retrieved successfully')
  @ApiOperation({
    summary: 'Get store config snapshot',
    description:
      'Returns the per-store data the mobile app needs to gate UI: store header, ' +
      "the user's roles in this store, the merged entity permission map, and a " +
      'SHA-256 configHash for drift detection. Membership is enforced; non-members ' +
      'get 404 (no probe leak).',
  })
  async getStoreConfig(
    @Param('storeGuuid') storeGuuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<StoreConfig> {
    return this.storeConfig.getConfig(user.userId, storeGuuid);
  }
}
