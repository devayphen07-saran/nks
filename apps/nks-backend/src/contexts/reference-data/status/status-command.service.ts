import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { StatusRepository } from './repositories/status.repository';
import { StatusMapper } from './mapper/status.mapper';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import type { CreateStatusDto, UpdateStatusDto, StatusResponse } from './dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';

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
      createdBy,
    });

    const response = StatusMapper.buildStatusDto(row);
    this.auditCommand.logStatusCreated(createdBy, response.guuid, response.code);
    return response;
  }

  async updateStatus(existing: Status, dto: UpdateStatusDto, modifiedBy: number): Promise<StatusResponse> {
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
    this.auditCommand.logStatusUpdated(modifiedBy, response.guuid, response.code, { ...dto });
    return response;
  }

  async deleteStatus(existing: Status, deletedBy: number): Promise<void> {
    if (existing.isSystem) throw new ForbiddenException(errPayload(ErrorCode.STA_SYSTEM_IMMUTABLE));
    await this.repository.softDelete(existing.id, deletedBy);
    this.auditCommand.logStatusDeleted(deletedBy, existing.guuid, existing.code);
  }
}
