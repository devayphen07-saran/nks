import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatusQueryService } from './status-query.service';
import type { StatusResponse } from './dto/status.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Statuses')
@Controller('statuses')
export class StatusController {
  constructor(private readonly statusQuery: StatusQueryService) {}

  @Get()
  @Public()
  @ResponseMessage('Statuses retrieved successfully')
  @ApiOperation({ summary: 'List all active statuses (public)' })
  async getActiveStatuses(): Promise<StatusResponse[]> {
    return this.statusQuery.getActiveStatuses();
  }
}
