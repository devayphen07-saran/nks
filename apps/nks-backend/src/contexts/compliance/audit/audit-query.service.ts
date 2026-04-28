import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { AuditMapper } from './mapper/audit.mapper';
import { NotFoundException } from '../../../common/exceptions';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type { AuditListQuery } from './dto/requests';
import type { AuditLogResponseDto } from './dto/responses';

@Injectable()
export class AuditQueryService {
  private readonly logger = new Logger(AuditQueryService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  async listLogs(query: AuditListQuery): Promise<PaginatedResult<AuditLogResponseDto>> {
    const { rows, total } = await this.auditRepository.findPage({
      page: query.page,
      pageSize: query.pageSize,
      userGuuid: query.userGuuid,
      storeGuuid: query.storeGuuid,
      action: query.action,
      entityType: query.entityType,
      isSuccess: query.isSuccess,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
    return paginated({ items: rows.map(AuditMapper.buildAuditLogDto), page: query.page, pageSize: query.pageSize, total });
  }

  async getByGuuid(auditGuuid: string): Promise<AuditLogResponseDto> {
    const row = await this.auditRepository.findByGuuid(auditGuuid);
    if (!row) throw new NotFoundException('Audit log not found');
    return AuditMapper.buildAuditLogDto(row);
  }
}
