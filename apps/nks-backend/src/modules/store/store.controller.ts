import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { StoreService } from './store.service';
import {
  RegisterStoreDto,
  StoreRegisterResponseDto,
  StoreListResponseDto,
  StoreDetailDto,
} from './dto';
import { StoreMapper } from './mapper';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post('register')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new store and assign current user as owner',
  })
  @SwaggerResponse({
    type: StoreRegisterResponseDto,
    status: 201,
    description: 'Store registered successfully',
  })
  async register(
    @CurrentUser('userId') userId: number,
    @Body() dto: RegisterStoreDto,
  ) {
    const result = await this.storeService.register(userId, dto);
    return ApiResponse.ok(
      StoreMapper.toRegisterResponseDto(result),
      'Store registered successfully',
    );
  }

  @Get('my-stores')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get stores owned by the current user' })
  async getMyStores(@CurrentUser('userId') userId: number) {
    const result = await this.storeService.getMyStores(userId);
    return ApiResponse.ok(result, 'Owned stores fetched');
  }

  @Get('invited')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get stores the current user was invited to as staff',
  })
  async getInvitedStores(@CurrentUser('userId') userId: number) {
    const result = await this.storeService.getInvitedStores(userId);
    return ApiResponse.ok(result, 'Invited stores fetched');
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get all accessible stores for the current user (paginated). Used by mobile app for store selection during auth flow.',
  })
  @SwaggerResponse({
    type: StoreListResponseDto,
    status: 200,
    description: 'Stores fetched successfully with pagination',
  })
  async listStores(
    @CurrentUser('userId') userId: number,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const result = await this.storeService.getAccessibleStores(
      userId,
      page,
      pageSize,
    );
    return ApiResponse.ok(result, 'Stores fetched successfully');
  }

  @Get(':storeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get store details by ID. Used by mobile app for store detail view.',
  })
  @SwaggerResponse({
    type: StoreDetailDto,
    status: 200,
    description: 'Store details fetched successfully',
  })
  async getStoreDetail(
    @Param('storeId', ParseIntPipe) storeId: number,
  ) {
    const result = await this.storeService.getStoreById(storeId);
    if (!result) {
      return ApiResponse.error('Store not found', 'STORE_NOT_FOUND');
    }
    return ApiResponse.ok(result, 'Store details fetched successfully');
  }
}
