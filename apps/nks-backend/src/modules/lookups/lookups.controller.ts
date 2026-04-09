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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiResponse } from '../../common/utils/api-response';
import { Public } from '../../common/decorators/public.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
  PlanTypesListResponse,
  TaxLineStatusesListResponse,
  EntityTypesListResponse,
  NotificationStatusesListResponse,
  StaffInviteStatusesListResponse,
  BillingFrequenciesListResponse,
  TaxRegistrationTypesListResponse,
  TaxFilingFrequenciesListResponse,
} from './dto/lookups-response.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  LookupTypesListResponse,
  LookupValuesListResponse,
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

  // ── Public: NEW Dedicated Lookup Tables (Phase 1 Normalization) ──────────────

  /**
   * GET /lookups/plan-types
   * Get all active plan types (STARTER, PROFESSIONAL, ENTERPRISE, PREMIUM, STANDARD, TRIAL)
   */
  @Get('plan-types')
  @Public()
  async getPlanTypes(): Promise<ApiResponse<PlanTypesListResponse>> {
    const data = await this.lookupsService.getPlanTypes();
    return ApiResponse.ok(data, 'Plan types retrieved successfully');
  }

  /**
   * GET /lookups/tax-line-statuses
   * Get all active tax line statuses (PENDING, APPROVED, REJECTED)
   */
  @Get('tax-line-statuses')
  @Public()
  async getTaxLineStatuses(): Promise<
    ApiResponse<TaxLineStatusesListResponse>
  > {
    const data = await this.lookupsService.getTaxLineStatuses();
    return ApiResponse.ok(data, 'Tax line statuses retrieved successfully');
  }

  /**
   * GET /lookups/entity-types
   * Get all active entity types for role permissions (INVOICE, PRODUCT, CUSTOMER, etc.)
   */
  @Get('entity-types')
  @Public()
  async getEntityTypes(): Promise<ApiResponse<EntityTypesListResponse>> {
    const data = await this.lookupsService.getEntityTypes();
    return ApiResponse.ok(data, 'Entity types retrieved successfully');
  }

  /**
   * GET /lookups/notification-statuses
   * Get all active notification statuses (PENDING, SENT, DELIVERED, READ, FAILED, EXPIRED)
   */
  @Get('notification-statuses')
  @Public()
  async getNotificationStatuses(): Promise<
    ApiResponse<NotificationStatusesListResponse>
  > {
    const data = await this.lookupsService.getNotificationStatuses();
    return ApiResponse.ok(data, 'Notification statuses retrieved successfully');
  }

  /**
   * GET /lookups/staff-invite-statuses
   * Get all active staff invite statuses (PENDING, ACCEPTED, REVOKED, EXPIRED)
   */
  @Get('staff-invite-statuses')
  @Public()
  async getStaffInviteStatuses(): Promise<
    ApiResponse<StaffInviteStatusesListResponse>
  > {
    const data = await this.lookupsService.getStaffInviteStatuses();
    return ApiResponse.ok(data, 'Staff invite statuses retrieved successfully');
  }

  /**
   * GET /lookups/billing-frequencies
   * Get all active billing frequencies (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, ONE_TIME)
   */
  @Get('billing-frequencies')
  @Public()
  async getBillingFrequencies(): Promise<
    ApiResponse<BillingFrequenciesListResponse>
  > {
    const data = await this.lookupsService.getBillingFrequencies();
    return ApiResponse.ok(data, 'Billing frequencies retrieved successfully');
  }

  /**
   * GET /lookups/tax-registration-types
   * Get all active tax registration types (REGULAR, COMPOSITION, EXEMPT, SEZ, SPECIAL)
   */
  @Get('tax-registration-types')
  @Public()
  async getTaxRegistrationTypes(): Promise<
    ApiResponse<TaxRegistrationTypesListResponse>
  > {
    const data = await this.lookupsService.getTaxRegistrationTypes();
    return ApiResponse.ok(
      data,
      'Tax registration types retrieved successfully',
    );
  }

  /**
   * GET /lookups/tax-filing-frequencies
   * Get all active tax filing frequencies (MONTHLY, QUARTERLY, HALF_YEARLY, ANNUAL)
   */
  @Get('tax-filing-frequencies')
  @Public()
  async getTaxFilingFrequencies(): Promise<
    ApiResponse<TaxFilingFrequenciesListResponse>
  > {
    const data = await this.lookupsService.getTaxFilingFrequencies();
    return ApiResponse.ok(
      data,
      'Tax filing frequencies retrieved successfully',
    );
  }

  // ── Admin: Lookup Configuration ─────────────────────────────────────────────

  /**
   * GET /admin/lookups
   * SUPER_ADMIN — Sidebar: all code-based lookup categories with value counts.
   */
  @Get('admin')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all lookup types (SUPER_ADMIN)' })
  async getAllLookupTypes(): Promise<ApiResponse<LookupTypesListResponse>> {
    const data = await this.lookupsService.getAllLookupTypes();
    return ApiResponse.ok(data, 'Lookup types retrieved successfully');
  }

  /**
   * GET /admin/lookups/:code
   * SUPER_ADMIN — Values list for a selected lookup type.
   */
  @Get('admin/:code')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get values for a lookup type (SUPER_ADMIN)' })
  async getLookupValues(
    @Param('code') code: string,
  ): Promise<ApiResponse<LookupValuesListResponse>> {
    const data = await this.lookupsService.getLookupValues(code);
    return ApiResponse.ok(data, 'Lookup values retrieved successfully');
  }

  /**
   * POST /admin/lookups/:code
   * SUPER_ADMIN — Add a new value to a lookup type.
   */
  @Post('admin/:code')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lookup value (SUPER_ADMIN)' })
  async createLookupValue(
    @Param('code') code: string,
    @Body() dto: CreateLookupValueDto,
  ): Promise<ApiResponse<LookupValuesListResponse>> {
    const data = await this.lookupsService.createLookupValue(code, dto);
    return ApiResponse.ok(data, 'Lookup value created successfully');
  }

  /**
   * PUT /admin/lookups/:code/:id
   * SUPER_ADMIN — Update an existing lookup value.
   */
  @Put('admin/:code/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a lookup value (SUPER_ADMIN)' })
  async updateLookupValue(
    @Param('code') code: string,
    @Param('id') id: string,
    @Body() dto: UpdateLookupValueDto,
  ): Promise<ApiResponse<LookupValuesListResponse>> {
    const data = await this.lookupsService.updateLookupValue(code, +id, dto);
    return ApiResponse.ok(data, 'Lookup value updated successfully');
  }

  /**
   * DELETE /admin/lookups/:code/:id
   * SUPER_ADMIN — Remove a lookup value.
   */
  @Delete('admin/:code/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lookup value (SUPER_ADMIN)' })
  async deleteLookupValue(
    @Param('code') code: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.lookupsService.deleteLookupValue(code, +id);
  }
}
