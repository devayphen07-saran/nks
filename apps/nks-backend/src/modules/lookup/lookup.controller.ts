import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LookupService } from './lookup.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ApiResponse } from '../../common/utils/api-response';
import { LookupMapper } from './mapper';

@ApiTags('Lookups')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('lookups')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get('store-legal-types')
  @ApiOperation({
    summary:
      'List all active store legal types (e.g. Pvt Ltd, Sole Proprietor)',
  })
  async storeLegalTypes() {
    const data = await this.lookupService.getStoreLegalTypes();
    const mapped = data.map((d) => LookupMapper.toStoreLegalTypeResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('salutations')
  @ApiOperation({
    summary: 'List all active salutations (e.g. Mr., Mrs., Dr.)',
  })
  async salutations() {
    const data = await this.lookupService.getSalutations();
    const mapped = data.map((d) => LookupMapper.toSalutationResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('dial-codes')
  @ApiOperation({
    summary:
      'List all countries with a dial code (e.g. +91 India, +1 United States)',
  })
  async dialCodes() {
    const data = await this.lookupService.getDialCodes();
    const mapped = data.map((d) => LookupMapper.toDialCodeResponseDto(d));
    return ApiResponse.ok(mapped);
  }

  @Get('designations')
  @ApiOperation({
    summary: 'List all active designations (e.g. CEO, Store Manager)',
  })
  async designations() {
    const data = await this.lookupService.getDesignations();
    const mapped = data.map((d) => LookupMapper.toDesignationResponseDto(d));
    return ApiResponse.ok(mapped);
  }
}
