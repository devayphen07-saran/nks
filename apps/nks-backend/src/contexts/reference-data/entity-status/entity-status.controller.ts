import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EntityStatusService } from './entity-status.service';
import type { EntityStatusResponse } from './dto/entity-status.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Entity Status')
@Controller('entity-status')
export class EntityStatusController {
  constructor(private readonly entityStatusService: EntityStatusService) {}

  @Get(':entityCode/public')
  @Public()
  @ResponseMessage('Entity statuses retrieved successfully')
  @ApiOperation({ summary: 'Get active statuses for an entity (public)' })
  async getEntityStatusesPublic(
    @Param('entityCode') entityCode: string,
  ): Promise<EntityStatusResponse[]> {
    return this.entityStatusService.getStatusesForEntity(entityCode);
  }
}
