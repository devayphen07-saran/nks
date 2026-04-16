import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService, StoreDto } from './stores.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

@ApiTags('Stores')
@Controller('stores')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * GET /stores/me
   * Returns all stores the authenticated user belongs to:
   * - myStores: stores the user owns (ownerUserFk = userId)
   * - invitedStores: stores where the user has a staff membership
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get stores for authenticated user',
    description:
      'Returns owned stores (myStores) and staff stores (invitedStores) for the current user.',
  })
  async getMyStores(
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<{ myStores: StoreDto[]; invitedStores: StoreDto[] }>> {
    const result = await this.storesService.getMyStores(user.userId);
    return ApiResponse.ok(result, 'Stores retrieved successfully');
  }
}
