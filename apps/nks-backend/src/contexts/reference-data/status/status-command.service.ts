import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { StatusRepository } from './repositories/status.repository';
import { StatusMapper } from './mapper/status.mapper';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import type { CreateStatusDto, UpdateStatusDto, StatusResponse } from './dto/status.dto';
import type { Status, UpdateStatus } from '../../../core/database/schema/entity-system/status/status.table';

/**
 * StatusCommandService
 *
 * Manages status lifecycle (create, update, delete).
 * All methods require platform-level STATUS.CREATE/EDIT/DELETE permissions
 * (checked by @RequirePermission decorator at controller level).
 *
 * Authorization Contract:
 *   - Caller must have STATUS.CREATE permission to call createStatus()
 *   - Caller must have STATUS.EDIT permission to call updateStatus()
 *   - Caller must have STATUS.DELETE permission to call deleteStatus()
 *
 * Business Rule Validation:
 *   - System statuses (isSystem=true) are immutable — cannot be modified or deleted
 *   - Prevents accidental modification of critical system states
 *
 * Audit Trail:
 *   - All operations tracked via AuditCommandService
 *   - userId/createdBy/modifiedBy parameters identify who performed the operation
 */
@Injectable()
export class StatusCommandService {

  constructor(
    private readonly repository: StatusRepository,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async createStatus(dto: CreateStatusDto, createdBy: number): Promise<StatusResponse> {
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
    this.auditCommand.logStatusCreated(createdBy, response.guuid, response.code);
    return response;
  }

  async updateStatus(existing: Status, dto: UpdateStatusDto, modifiedBy: number): Promise<StatusResponse> {
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
    this.auditCommand.logStatusUpdated(modifiedBy, response.guuid, response.code, set);
    return response;
  }

  async deleteStatus(existing: Status, deletedBy: number): Promise<void> {
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));
    const deleted = await this.repository.softDelete(existing.id, deletedBy);
    if (!deleted) throw new NotFoundException(errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
    this.auditCommand.logStatusDeleted(deletedBy, existing.guuid, existing.code);
  }
}
