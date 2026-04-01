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
  Req,
  ParseIntPipe,
  NotFoundException,
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
import { ForbiddenException } from '../../common/exceptions';
import { RoutesService } from '../routes/routes.service';
import { AuthService } from '../auth/services/auth.service';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly routesService: RoutesService,
    private readonly authService: AuthService,
  ) {}

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

  @Get('dashboard/routes')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get routes and permissions for the active store',
    description:
      "Returns navigation routes and permission codes scoped to the user's role(s) in the currently active store. Call this after POST /auth/store/select.",
  })
  async getStoreRoutes(
    @Req() req: AuthenticatedRequest,
    @CurrentUser('userId') userId: number,
  ) {
    const token = (req.headers.authorization ?? '')
      .replace('Bearer ', '')
      .trim();
    const result = await this.routesService.getStoreRoutes(userId, token);
    return ApiResponse.ok(result, 'Store routes retrieved');
  }

  @Post('select/:storeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select/switch to a store context (recommended endpoint)',
    description:
      'Set the active store for this session. Returns routes and permissions scoped to the user\'s role(s) in that store. Used by mobile app for store switching. Prefer this over /auth/store/select',
  })
  async selectStore(
    @CurrentUser('userId') userId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const token = (req.headers.authorization ?? '')
      .replace('Bearer ', '')
      .trim();

    // Switch store (validates access + updates session)
    const result = await this.authService.switchStore(userId, token, storeId);
    return ApiResponse.ok(result, 'Store selected successfully');
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
    @CurrentUser('userId') userId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
  ) {
    // Verify user has access to this store
    const hasAccess = await this.storeService.userHasAccessToStore(
      userId,
      storeId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this store');
    }

    const result = await this.storeService.getStoreById(storeId);
    if (!result) {
      throw new NotFoundException('Store not found');
    }
    return ApiResponse.ok(result, 'Store details fetched successfully');
  }
}
