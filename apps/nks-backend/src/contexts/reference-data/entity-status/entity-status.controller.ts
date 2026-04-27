import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EntityStatusQueryService } from './entity-status-query.service';
import type { EntityStatusResponse } from './dto/entity-status.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Entity Status')
@Controller('entity-status')
export class EntityStatusController {
  constructor(private readonly entityStatusQuery: EntityStatusQueryService) {}

  @Get(':entityCode/public')
  @Public()
  @ResponseMessage('Entity statuses retrieved successfully')
  @ApiOperation({ summary: 'Get active statuses for an entity (public)' })
  async getEntityStatusesPublic(
    @Param('entityCode') entityCode: string,
  ): Promise<EntityStatusResponse[]> {
    return this.entityStatusQuery.getStatusesForEntity(entityCode);
  }
}
