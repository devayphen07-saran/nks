import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatusService } from './status.service';
import type { StatusResponse } from './dto/status.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Statuses')
@Controller('statuses')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  @Public()
  @ResponseMessage('Statuses retrieved successfully')
  @ApiOperation({ summary: 'List all active statuses (public)' })
  async getActiveStatuses(): Promise<StatusResponse[]> {
    return this.statusService.getActiveStatuses();
  }
}
