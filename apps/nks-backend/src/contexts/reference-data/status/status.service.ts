import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { StatusRepository } from './repositories/status.repository';
import { StatusMapper } from './mapper/status.mapper';
import { AuditService } from '../../compliance/audit/audit.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type {
  CreateStatusDto,
  UpdateStatusDto,
  StatusResponse,
} from './dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';

@Injectable()
export class StatusService {
  constructor(
    private readonly repository: StatusRepository,
    private readonly auditService: AuditService,
  ) {}

  async getActiveStatuses(): Promise<StatusResponse[]> {
    const rows = await this.repository.findActive();
    return rows.map(StatusMapper.buildStatusDto);
  }

  async listStatuses(opts: { page: number; pageSize: number; search?: string }): Promise<PaginatedResult<StatusResponse>> {
    const { rows, total } = await this.repository.findPage(opts);
    return paginated({ items: rows.map(StatusMapper.buildStatusDto), page: opts.page, pageSize: opts.pageSize, total });
  }

  async createStatus(
    dto: CreateStatusDto,
    createdBy: number,
  ): Promise<StatusResponse> {
    const existing = await this.repository.findByCode(dto.code.toUpperCase());
    if (existing) throw new ConflictException(errPayload(ErrorCode.STA_CODE_ALREADY_EXISTS));

    const row = await this.repository.create({
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description,
      fontColor: dto.fontColor ?? null,
      bgColor: dto.bgColor ?? null,
      borderColor: dto.borderColor ?? null,
      isBold: dto.isBold ?? false,
      sortOrder: dto.sortOrder,
      createdBy,
    });

    const response = StatusMapper.buildStatusDto(row);
    this.auditService.logStatusCreated(createdBy, response.guuid, response.code);
    return response;
  }

  async updateStatus(
    guuid: string,
    dto: UpdateStatusDto,
    modifiedBy: number,
  ): Promise<StatusResponse> {
    const existing = await this.repository.findByGuuid(guuid);
    if (!existing) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));

    const row = await this.repository.update(existing.id, {
      name: dto.name,
      description: dto.description,
      fontColor: dto.fontColor ?? undefined,
      bgColor: dto.bgColor ?? undefined,
      borderColor: dto.borderColor ?? undefined,
      isBold: dto.isBold,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      modifiedBy,
    });

    if (!row) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    const response = StatusMapper.buildStatusDto(row);
    this.auditService.logStatusUpdated(modifiedBy, response.guuid, response.code, { ...dto });
    return response;
  }

  async deleteStatus(guuid: string, deletedBy: number): Promise<void> {
    const existing = await this.repository.findByGuuid(guuid);
    if (!existing) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));

    await this.repository.softDelete(existing.id, deletedBy);
    this.auditService.logStatusDeleted(deletedBy, existing.guuid, existing.code);
  }

  async findByGuuid(guuid: string): Promise<Status | null> {
    return this.repository.findByGuuid(guuid);
  }
}
