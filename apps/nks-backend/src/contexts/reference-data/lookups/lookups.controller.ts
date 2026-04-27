import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { LookupsQueryService } from './lookups-query.service';
import type { PublicLookupItem } from './dto/lookups-response.dto';

@ApiTags('Lookups')
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsQuery: LookupsQueryService) {}

  @Get(':code')
  @Public()
  @ResponseMessage('Lookup retrieved successfully')
  @ApiOperation({ summary: 'Get a public lookup list by code' })
  async getLookup(@Param('code') code: string): Promise<PublicLookupItem[]> {
    return this.lookupsQuery.getPublicLookup(code);
  }
}
