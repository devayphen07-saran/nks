import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { LookupsQueryService } from './lookups-query.service';
import { BatchLookupRequestDto } from './dto/lookups-response.dto';
import type { PublicLookupItem, BatchLookupResponse } from './dto/lookups-response.dto';

/**
 * LookupsController — single public entry point for value-list reads.
 *
 * One route, DB-driven routing. Clients pass either a friendly slug
 * ("address-types") or the canonical lookup_type.code ("ADDRESS_TYPE").
 * Service-side, has_table on lookup_type decides whether the response comes
 * from the generic `lookup` table or a dedicated-table mapper.
 */
@ApiTags('Lookups')
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsQuery: LookupsQueryService) {}

  @Get(':typeCode')
  @Public()
  @ResponseMessage('Lookup retrieved successfully')
  @ApiOperation({
    summary: 'Get a public lookup list by code or slug',
    description:
      'Accepts either a lookup_type.code (e.g. "ADDRESS_TYPE") or a friendly ' +
      'kebab-case slug (e.g. "address-types"). Returns 404 if not registered.',
  })
  @ApiParam({
    name: 'typeCode',
    example: 'address-types',
    description: 'Slug or lookup_type.code',
  })
  async getLookup(@Param('typeCode') typeCode: string): Promise<PublicLookupItem[]> {
    return this.lookupsQuery.getPublicLookup(typeCode);
  }

  @Post('batch')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Batch lookups retrieved successfully')
  @ApiOperation({
    summary: 'Fetch multiple lookup lists in one request',
    description:
      'Pass up to 20 type codes or slugs; returns a map of { [typeCode]: items[] }. ' +
      'Unknown or non-public types return an empty array rather than failing the batch.',
  })
  @ApiBody({ type: BatchLookupRequestDto })
  async getBatchLookups(@Body() dto: BatchLookupRequestDto): Promise<BatchLookupResponse> {
    return this.lookupsQuery.getBatchLookups(dto.types);
  }
}
