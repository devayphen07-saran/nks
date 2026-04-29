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
  GetAllStatusesQueryDto,
  StatusResponse,
} from './dto/status.dto';
import type { Status, UpdateStatus } from '../../../core/database/schema/entity-system/status/status.table';

/**
 * StatusService
 *
 * Manages status lifecycle (read, create, update, delete).
 * NOTE: This service mirrors StatusCommandService. Command operations should use
 * StatusCommandService (has explicit permission ceiling docs). This service is
 * kept for combined query+command operations.
 *
 * Authorization Contract:
 *   - getActiveStatuses(), listStatuses(): Public reads (no auth needed)
 *   - createStatus(), updateStatus(), deleteStatus(): Require STATUS.CREATE/EDIT/DELETE
 *     permissions (checked by @RequirePermission decorator at controller level)
 *   - Authorization is enforced at controller level, not service level
 *
 * Business Rule Validation:
 *   - System statuses (isSystem=true) are immutable — cannot be modified or deleted
 *   - Status codes must be unique
 *   - Prevents accidental modification of critical system states
 *
 * Audit Trail:
 *   - All mutations tracked via AuditService
 *   - createdBy/modifiedBy/deletedBy parameters identify who performed the operation
 */
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

  async listStatuses(opts: GetAllStatusesQueryDto): Promise<PaginatedResult<StatusResponse>> {
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
    }, createdBy);

    const response = StatusMapper.buildStatusDto(row);
    this.auditService.logStatusCreated(createdBy, response.guuid, response.code);
    return response;
  }

  async updateStatus(
    existing: Status,
    dto: UpdateStatusDto,
    modifiedBy: number,
  ): Promise<StatusResponse> {
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));

    const set: UpdateStatus = {};
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.description !== undefined) set.description = dto.description;
    if (dto.fontColor !== undefined) set.fontColor = dto.fontColor;
    if (dto.bgColor !== undefined) set.bgColor = dto.bgColor;
    if (dto.borderColor !== undefined) set.borderColor = dto.borderColor;
    if (dto.isBold !== undefined) set.isBold = dto.isBold;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) set.isActive = dto.isActive;

    const row = await this.repository.update(existing.id, set, modifiedBy);

    if (!row) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    const response = StatusMapper.buildStatusDto(row);
    this.auditService.logStatusUpdated(modifiedBy, response.guuid, response.code, set);
    return response;
  }

  async deleteStatus(existing: Status, deletedBy: number): Promise<void> {
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));

    const deleted = await this.repository.softDelete(existing.id, deletedBy);
    if (!deleted) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    this.auditService.logStatusDeleted(deletedBy, existing.guuid, existing.code);
  }

  async findByGuuid(guuid: string): Promise<Status | null> {
    return this.repository.findByGuuid(guuid);
  }
}
