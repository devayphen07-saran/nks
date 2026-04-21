import { Injectable } from '@nestjs/common';
import { StatusRepository } from './repositories/status.repository';
import { StatusMapper } from './mapper/status.mapper';
import { StatusValidator } from './validators';
import type {
  CreateStatusDto,
  UpdateStatusDto,
  StatusResponse,
} from './dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';

@Injectable()
export class StatusService {
  constructor(private readonly repository: StatusRepository) {}

  // ─── Public: active statuses (used by consumers to render badges) ───────────

  async getActiveStatuses() {
    const rows = await this.repository.findActive();
    return rows.map(StatusMapper.toResponse);
  }

  // ─── Admin: all statuses including inactive ──────────────────────────────────

  async listStatuses(opts: { page: number; pageSize: number; search?: string }) {
    const { rows, total } = await this.repository.findPage(opts);
    return { rows: rows.map(StatusMapper.toResponse), total };
  }

  // ─── Admin: create ───────────────────────────────────────────────────────────

  async createStatus(
    dto: CreateStatusDto,
    createdBy: number,
  ): Promise<StatusResponse> {
    const existing = await this.repository.findByCode(dto.code.toUpperCase());
    StatusValidator.assertCodeUnique(existing);

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

    return StatusMapper.toResponse(row);
  }

  // ─── Admin: update ───────────────────────────────────────────────────────────

  async updateStatus(
    guuid: string,
    dto: UpdateStatusDto,
    modifiedBy: number,
  ): Promise<StatusResponse> {
    const existing = await this.repository.findByGuuid(guuid);
    StatusValidator.assertFound(existing);
    StatusValidator.assertNotSystem(existing.isSystem);

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

    StatusValidator.assertFound(row);
    return StatusMapper.toResponse(row);
  }

  // ─── Admin: delete ───────────────────────────────────────────────────────────

  async deleteStatus(guuid: string, deletedBy: number): Promise<void> {
    const existing = await this.repository.findByGuuid(guuid);
    StatusValidator.assertFound(existing);
    StatusValidator.assertNotSystem(existing.isSystem);

    await this.repository.softDelete(existing.id, deletedBy);
  }

  // ─── Internal lookup (used by other modules via StatusService) ───────────────

  /** Resolves a status by GUUID. Returns null if not found. */
  async findByGuuid(guuid: string): Promise<Status | null> {
    return this.repository.findByGuuid(guuid);
  }
}
