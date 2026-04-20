import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiResponse } from '../../common/utils/api-response';
import { Public } from '../../common/decorators/public.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { LookupsService } from './lookups.service';
import type {
  SalutationsListResponse,
  CountriesListResponse,
  AddressTypesListResponse,
  CommunicationTypesListResponse,
  DesignationsListResponse,
  StoreLegalTypesListResponse,
  StoreCategoriesListResponse,
  CurrenciesListResponse,
  VolumesListResponse,
} from './dto/lookups-response.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  LookupTypesListResponse,
  LookupValuesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';

@ApiTags('Lookups')
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  /**
   * GET /lookups/salutations
   * Get all active salutation types (Mr., Mrs., Dr., etc.)
   */
  @Get('salutations')
  @Public()
  async getSalutations(): Promise<ApiResponse<SalutationsListResponse>> {
    const data = await this.lookupsService.getSalutations();
    return ApiResponse.ok(data, 'Salutations retrieved successfully');
  }

  /**
   * GET /lookups/countries
   * Get all active countries with ISO codes and dialing codes
   */
  @Get('countries')
  @Public()
  async getCountries(): Promise<ApiResponse<CountriesListResponse>> {
    const data = await this.lookupsService.getCountries();
    return ApiResponse.ok(data, 'Countries retrieved successfully');
  }

  /**
   * GET /lookups/address-types
   * Get all active address types (Home, Office, Shipping, Billing, etc.)
   */
  @Get('address-types')
  @Public()
  async getAddressTypes(): Promise<ApiResponse<AddressTypesListResponse>> {
    const data = await this.lookupsService.getAddressTypes();
    return ApiResponse.ok(data, 'Address types retrieved successfully');
  }

  /**
   * GET /lookups/communication-types
   * Get all active communication types (Mobile, Email, Fax, WhatsApp, etc.)
   */
  @Get('communication-types')
  @Public()
  async getCommunicationTypes(): Promise<
    ApiResponse<CommunicationTypesListResponse>
  > {
    const data = await this.lookupsService.getCommunicationTypes();
    return ApiResponse.ok(data, 'Communication types retrieved successfully');
  }

  /**
   * GET /lookups/designations
   * Get all active designations (CEO, Manager, Staff, etc.)
   */
  @Get('designations')
  @Public()
  async getDesignations(): Promise<ApiResponse<DesignationsListResponse>> {
    const data = await this.lookupsService.getDesignations();
    return ApiResponse.ok(data, 'Designations retrieved successfully');
  }

  /**
   * GET /lookups/store-legal-types
   * Get all active store legal types (Pvt Ltd, Sole Proprietor, Partnership, etc.)
   */
  @Get('store-legal-types')
  @Public()
  async getStoreLegalTypes(): Promise<
    ApiResponse<StoreLegalTypesListResponse>
  > {
    const data = await this.lookupsService.getStoreLegalTypes();
    return ApiResponse.ok(data, 'Store legal types retrieved successfully');
  }

  /**
   * GET /lookups/store-categories
   * Get all active store categories (Grocery, Pharmacy, Restaurant, etc.)
   */
  @Get('store-categories')
  @Public()
  async getStoreCategories(): Promise<
    ApiResponse<StoreCategoriesListResponse>
  > {
    const data = await this.lookupsService.getStoreCategories();
    return ApiResponse.ok(data, 'Store categories retrieved successfully');
  }

  /**
   * GET /lookups/currencies
   * Get all active currencies (INR, USD, EUR, etc.)
   */
  @Get('currencies')
  @Public()
  async getCurrencies(): Promise<ApiResponse<CurrenciesListResponse>> {
    const data = await this.lookupsService.getCurrencies();
    return ApiResponse.ok(data, 'Currencies retrieved successfully');
  }

  /**
   * GET /lookups/volumes
   * Get all active volume/unit types (Kilogram, Litre, Piece, etc.)
   */
  @Get('volumes')
  @Public()
  async getVolumes(): Promise<ApiResponse<VolumesListResponse>> {
    const data = await this.lookupsService.getVolumes();
    return ApiResponse.ok(data, 'Volumes retrieved successfully');
  }

  // ── Admin: Lookup Configuration ─────────────────────────────────────────────

  /**
   * GET /admin/lookups
   * All code-based lookup categories with value counts.
   */
  @Get('admin')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all lookup types' })
  async getAllLookupTypes(): Promise<ApiResponse<LookupTypesListResponse>> {
    const data = await this.lookupsService.getAllLookupTypes();
    return ApiResponse.ok(data, 'Lookup types retrieved successfully');
  }

  /**
   * GET /admin/lookups/:code
   * Values list for a selected lookup type.
   */
  @Get('admin/:code')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get values for a lookup type' })
  async getLookupValues(
    @Param('code') code: string,
  ): Promise<ApiResponse<LookupValuesListResponse>> {
    const data = await this.lookupsService.getLookupValues(code);
    return ApiResponse.ok(data, 'Lookup values retrieved successfully');
  }

  /**
   * POST /admin/lookups/:code
   * Add a new value to a lookup type.
   */
  @Post('admin/:code')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.CREATE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lookup value' })
  async createLookupValue(
    @Param('code') code: string,
    @Body() dto: CreateLookupValueDto,
  ): Promise<ApiResponse<LookupValueAdminResponse>> {
    const data = await this.lookupsService.createLookupValue(code, dto);
    return ApiResponse.ok(data, 'Lookup value created successfully');
  }

  /**
   * PUT /admin/lookups/:code/:id
   * Update an existing lookup value.
   */
  @Put('admin/:code/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.EDIT })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a lookup value' })
  async updateLookupValue(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLookupValueDto,
  ): Promise<ApiResponse<LookupValueAdminResponse>> {
    const data = await this.lookupsService.updateLookupValue(code, id, dto);
    return ApiResponse.ok(data, 'Lookup value updated successfully');
  }

  /**
   * DELETE /admin/lookups/:code/:id
   * Remove a lookup value.
   */
  @Delete('admin/:code/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.DELETE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lookup value' })
  async deleteLookupValue(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.lookupsService.deleteLookupValue(code, id);
  }
}
