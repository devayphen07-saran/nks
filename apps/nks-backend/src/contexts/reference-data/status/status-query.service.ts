import { Injectable, Logger } from '@nestjs/common';
import { StatusRepository } from './repositories/status.repository';
import { StatusMapper } from './mapper/status.mapper';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type { GetAllStatusesQueryDto, StatusResponse } from './dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';

@Injectable()
export class StatusQueryService {
  private readonly logger = new Logger(StatusQueryService.name);

  constructor(private readonly repository: StatusRepository) {}

  async getActiveStatuses(): Promise<StatusResponse[]> {
    const rows = await this.repository.findActive();
    return rows.map(StatusMapper.buildStatusDto);
  }

  async listStatuses(opts: GetAllStatusesQueryDto): Promise<PaginatedResult<StatusResponse>> {
    const { rows, total } = await this.repository.findPage(opts);
    return paginated({ items: rows.map(StatusMapper.buildStatusDto), page: opts.page, pageSize: opts.pageSize, total });
  }

  async findByGuuid(guuid: string): Promise<Status | null> {
    return this.repository.findByGuuid(guuid);
  }
}
