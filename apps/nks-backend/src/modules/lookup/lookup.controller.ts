import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LookupService } from './lookup.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';
import { LookupMapper } from './mapper';
import {
  CreateStoreLegalTypeDto,
  UpdateStoreLegalTypeDto,
  CreateSalutationDto,
  UpdateSalutationDto,
  CreateStoreCategoryDto,
  UpdateStoreCategoryDto,
  CreateDesignationDto,
  UpdateDesignationDto,
} from './dto';

@ApiTags('Lookups')
@Controller('lookups')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  // ─── PUBLIC ENDPOINTS (No Auth Required) ────────────────────────────────────

  /**
   * Get all active countries with dial codes for phone selection
   * PUBLIC endpoint - used during authentication flow
   */
  @Get('public/dial-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all ACTIVE countries with dial codes for phone selection',
    description:
      'Returns only active countries. Used in authentication/registration flow. Public endpoint.',
  })
  async publicDialCodes() {
    const data = await this.lookupService.getDialCodes();
    const mapped = data.map((d) => LookupMapper.toDialCodeResponseDto(d));
    return ApiResponse.ok(mapped, 'Dial codes retrieved');
  }

  /**
   * Get all active countries for store registration
   * PUBLIC endpoint - used during store setup
   */
  @Get('public/countries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all ACTIVE countries for store registration',
    description:
      'Returns only active countries. Used during store onboarding. Public endpoint.',
  })
  async publicCountries() {
    const data = await this.lookupService.getCountries();
    return ApiResponse.ok(data, 'Countries retrieved');
  }

  // ─── AUTHENTICATED ENDPOINTS ─────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('store-legal-types')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active store legal types (Pvt Ltd, Sole Proprietor, etc)',
  })
  async storeLegalTypes() {
    const data = await this.lookupService.getStoreLegalTypes();
    const mapped = data.map((d) => LookupMapper.toStoreLegalTypeResponseDto(d));
    return ApiResponse.ok(mapped, 'Store legal types retrieved');
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('salutations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active salutations (Mr., Mrs., Dr., Prof., etc)',
  })
  async salutations() {
    const data = await this.lookupService.getSalutations();
    const mapped = data.map((d) => LookupMapper.toSalutationResponseDto(d));
    return ApiResponse.ok(mapped, 'Salutations retrieved');
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('designations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active designations (CEO, Manager, Staff, etc)',
  })
  async designations() {
    const data = await this.lookupService.getDesignations();
    const mapped = data.map((d) => LookupMapper.toDesignationResponseDto(d));
    return ApiResponse.ok(mapped, 'Designations retrieved');
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('store-categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active store categories (Grocery, Pharmacy, etc)',
  })
  async storeCategories() {
    const data = await this.lookupService.getStoreCategories();
    const mapped = data.map((d) => LookupMapper.toStoreCategoryResponseDto(d));
    return ApiResponse.ok(mapped, 'Store categories retrieved');
  }

  /**
   * Get all countries (with auth) - includes active and inactive
   * Returns complete country info (id, name, code, dialCode, currency, timezone)
   */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('admin/countries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Get all countries including inactive ones',
    description: 'Returns all countries. Admin-only endpoint for management.',
  })
  async adminCountries() {
    const data = await this.lookupService.getCountries();
    return ApiResponse.ok(data, 'Countries retrieved');
  }

  /**
   * Batch fetch all global configuration lookups
   * Single call to get all lookup data at once
   */
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch fetch all configuration lookups',
    description:
      'Returns all lookups: store legal types, salutations, designations, store categories, and countries',
  })
  async config() {
    const data = await this.lookupService.getGlobalConfig();
    const mapped = LookupMapper.toConfigResponseDto(data);
    return ApiResponse.ok(mapped, 'Configuration retrieved');
  }

  // Store Legal Types CRUD
  @Post('store-legal-types')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPER_ADMIN] Create store legal type' })
  async createStoreLegalType(
    @Body() dto: CreateStoreLegalTypeDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.createStoreLegalType(dto, userId);
    return ApiResponse.ok(data, 'Store legal type created');
  }

  @Put('store-legal-types/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[SUPER_ADMIN] Update store legal type' })
  async updateStoreLegalType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStoreLegalTypeDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.updateStoreLegalType(id, dto, userId);
    return ApiResponse.ok(data, 'Store legal type updated');
  }

  @Delete('store-legal-types/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[SUPER_ADMIN] Delete store legal type' })
  async deleteStoreLegalType(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    await this.lookupService.deleteStoreLegalType(id, userId);
    return ApiResponse.ok(null, 'Store legal type deleted');
  }

  // Salutations CRUD
  @Post('salutations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPER_ADMIN] Create salutation' })
  async createSalutation(
    @Body() dto: CreateSalutationDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.createSalutation(dto, userId);
    return ApiResponse.ok(data, 'Salutation created');
  }

  @Put('salutations/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Update salutation' })
  async updateSalutation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalutationDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.updateSalutation(id, dto, userId);
    return ApiResponse.ok(data, 'Salutation updated');
  }

  @Delete('salutations/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Delete salutation' })
  async deleteSalutation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    await this.lookupService.deleteSalutation(id, userId);
    return ApiResponse.ok(null, 'Salutation deleted');
  }

  // Store Categories CRUD
  @Post('store-categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPER_ADMIN] Create store category' })
  async createStoreCategory(
    @Body() dto: CreateStoreCategoryDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.createStoreCategory(dto, userId);
    return ApiResponse.ok(data, 'Store category created');
  }

  @Put('store-categories/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Update store category' })
  async updateStoreCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStoreCategoryDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.updateStoreCategory(id, dto, userId);
    return ApiResponse.ok(data, 'Store category updated');
  }

  @Delete('store-categories/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Delete store category' })
  async deleteStoreCategory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    await this.lookupService.deleteStoreCategory(id, userId);
    return ApiResponse.ok(null, 'Store category deleted');
  }

  // Designations CRUD (Global only)
  @Post('designations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[SUPER_ADMIN] Create global designation' })
  async createDesignation(
    @Body() dto: CreateDesignationDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.createDesignation(dto, userId);
    return ApiResponse.ok(data, 'Designation created');
  }

  @Put('designations/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Update global designation' })
  async updateDesignation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDesignationDto,
    @CurrentUser('userId') userId: number,
  ) {
    const data = await this.lookupService.updateDesignation(id, dto, userId);
    return ApiResponse.ok(data, 'Designation updated');
  }

  @Delete('designations/:id')
  @ApiOperation({ summary: '[SUPER_ADMIN] Delete global designation' })
  async deleteDesignation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    await this.lookupService.deleteDesignation(id, userId);
    return ApiResponse.ok(null, 'Designation deleted');
  }
}
