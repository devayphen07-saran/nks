import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { CreateTaxRegistrationDto } from './dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';
import { StoreService } from '../store/store.service';
import { ForbiddenException } from '../../common/exceptions';

/**
 * Tax Controller
 *
 * Exposes tax-related endpoints:
 * - Tax agency and name lookups (country-specific)
 * - Commodity code classification queries
 * - Tax rate determination for transactions
 * - Tax registration management
 * - Daily tax summary retrieval
 *
 * All endpoints require authentication and operate within the user's authorized store context.
 */
@ApiTags('Tax')
@Controller('tax')
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly storeService: StoreService,
  ) {}

  /**
   * Get tax agency by code
   * GET /tax/agencies/:code
   */
  @Get('agencies/:code')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tax agency by code',
  })
  async getTaxAgency(@Param('code') code: string) {
    const result = await this.taxService.getTaxAgency(code);
    return ApiResponse.ok(result, 'Tax agency retrieved');
  }

  /**
   * Get all tax agencies for a country
   * GET /tax/agencies/country/:countryId
   */
  @Get('agencies/country/:countryId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tax agencies for a country',
  })
  async getTaxAgenciesByCountry(
    @Param('countryId', ParseIntPipe) countryId: number,
  ) {
    const result = await this.taxService.getTaxAgenciesByCountry(countryId);
    return ApiResponse.ok(result, 'Tax agencies retrieved');
  }

  /**
   * Get tax name by code
   * GET /tax/names/:code
   */
  @Get('names/:code')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tax type by code',
  })
  async getTaxName(@Param('code') code: string) {
    const result = await this.taxService.getTaxName(code);
    return ApiResponse.ok(result, 'Tax name retrieved');
  }

  /**
   * Get all tax names for an agency
   * GET /tax/names/agency/:agencyId
   */
  @Get('names/agency/:agencyId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tax types for an agency',
  })
  async getTaxNamesByAgency(@Param('agencyId', ParseIntPipe) agencyId: number) {
    const result = await this.taxService.getTaxNamesByAgency(agencyId);
    return ApiResponse.ok(result, 'Tax names retrieved');
  }

  /**
   * Get commodity code
   * GET /tax/commodities/:countryId/:code/:type
   */
  @Get('commodities/:countryId/:code/:type')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get commodity code by code and type (HSN, SAC, HS, CN, UNSPSC)',
  })
  async getCommodityCode(
    @Param('countryId', ParseIntPipe) countryId: number,
    @Param('code') code: string,
    @Param('type') type: string,
  ) {
    const validType = type as 'HSN' | 'SAC' | 'HS' | 'CN' | 'UNSPSC';
    const result = await this.taxService.getCommodityCode(
      countryId,
      code,
      validType,
    );
    return ApiResponse.ok(result, 'Commodity code retrieved');
  }

  /**
   * Get all commodity codes for a country
   * GET /tax/commodities/:countryId
   */
  @Get('commodities/:countryId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all commodity codes for a country',
  })
  async getCommodityCodesByCountry(
    @Param('countryId', ParseIntPipe) countryId: number,
  ) {
    const result = await this.taxService.getCommodityCodesByCountry(countryId);
    return ApiResponse.ok(result, 'Commodity codes retrieved');
  }

  /**
   * Get applicable tax rate for a transaction
   * GET /tax/rates/:storeId/:commodityCodeId/:transactionDate
   *
   * Returns the tax rate applicable to a specific commodity on a given date.
   * Used to calculate tax components (CGST/SGST for India, VAT for UK/EU, etc.)
   */
  @Get('rates/:storeId/:commodityCodeId/:transactionDate')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get applicable tax rate for a transaction (effective-date based lookup)',
  })
  async getApplicableTaxRate(
    @CurrentUser('userId') userId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('commodityCodeId', ParseIntPipe) commodityCodeId: number,
    @Param('transactionDate') transactionDate: string,
  ) {
    // Verify user has access to this store
    const hasAccess = await this.storeService.userHasAccessToStore(
      userId,
      storeId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this store');
    }

    const result = await this.taxService.getApplicableTaxRate(
      storeId,
      commodityCodeId,
      transactionDate,
    );
    return ApiResponse.ok(result, 'Tax rate retrieved');
  }

  /**
   * Get all tax rates for a store
   * GET /tax/rates/:storeId
   */
  @Get('rates/:storeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tax rates configured for a store',
  })
  async getTaxRatesByStore(
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

    const result = await this.taxService.getTaxRatesByStore(storeId);
    return ApiResponse.ok(result, 'Tax rates retrieved');
  }

  /**
   * Register a tax for a store
   * POST /tax/register
   *
   * Creates a tax_registrations record for a store, linking it to a tax agency
   * and tax name in a specific country. Stores the official registration number
   * (GSTIN, VAT number, etc.) and region code for multi-country support.
   */
  @Post('register')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a tax for a store',
    description:
      'Creates a tax registration record linking a store to a tax agency and tax type',
  })
  @SwaggerResponse({
    status: 201,
    description: 'Tax registered successfully',
  })
  async registerTax(
    @CurrentUser('userId') userId: number,
    @Body() dto: CreateTaxRegistrationDto,
  ) {
    // Verify user has access to the store they're registering tax for
    const hasAccess = await this.storeService.userHasAccessToStore(
      userId,
      dto.storeFk,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this store');
    }

    const result = await this.taxService.registerTax(userId, dto);
    return ApiResponse.ok(result, 'Tax registered successfully');
  }

  /**
   * Get all tax registrations for a store
   * GET /tax/registrations/:storeId
   */
  @Get('registrations/:storeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active tax registrations for a store',
  })
  async getTaxRegistrationsByStore(
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

    const result = await this.taxService.getTaxRegistrationsByStore(storeId);
    return ApiResponse.ok(result, 'Tax registrations retrieved');
  }

  /**
   * Get daily tax summary for a store
   * GET /tax/summary/:storeId/:countryId/:transactionDate
   *
   * Returns aggregated tax liability for a specific date, broken down by tax rate.
   * Used for tax return filing (GSTR, VAT returns, etc.) and dashboard reporting.
   */
  @Get('summary/:storeId/:countryId/:transactionDate')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get daily tax summary for a store (aggregated by tax rate, for filing)',
  })
  async getDailyTaxSummary(
    @CurrentUser('userId') userId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('countryId', ParseIntPipe) countryId: number,
    @Param('transactionDate') transactionDate: string,
  ) {
    // Verify user has access to this store
    const hasAccess = await this.storeService.userHasAccessToStore(
      userId,
      storeId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this store');
    }

    const result = await this.taxService.getDailyTaxSummary(
      storeId,
      countryId,
      transactionDate,
    );
    return ApiResponse.ok(result, 'Daily tax summary retrieved');
  }
}
