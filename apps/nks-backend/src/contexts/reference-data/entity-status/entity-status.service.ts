import { Injectable } from '@nestjs/common';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { StatusService } from '../status/status.service';
import { AuditService } from '../../compliance/audit/audit.service';
import type { AssignStatusDto, EntityStatusResponse } from './dto/entity-status.dto';
import { EntityStatusMapper } from './mapper/entity-status.mapper';
import { EntityCodeValidator, EntityStatusValidator } from './validators';

@Injectable()
export class EntityStatusService {
  constructor(
    private readonly repository:    EntityStatusRepository,
    private readonly statusService: StatusService,
    private readonly auditService:  AuditService,
  ) {}

  async getStatusesForEntity(entityCode: string): Promise<EntityStatusResponse[]> {
    const code = EntityCodeValidator.normalize(entityCode);
    EntityCodeValidator.validate(code);

    const rows = await this.repository.findByEntityCode(code);
    return rows.map(EntityStatusMapper.buildEntityStatusDto);
  }

  async assignStatus(entityCode: string, dto: AssignStatusDto, userId: number): Promise<EntityStatusResponse> {
    const code = EntityCodeValidator.normalize(entityCode);
    EntityCodeValidator.validate(code);

    const statusRow = await this.statusService.findByGuuid(dto.statusGuuid);
    EntityStatusValidator.assertStatusFound(statusRow);

    const existing = await this.repository.findMapping(code, statusRow.id);
    EntityStatusValidator.assertNotAlreadyAssigned(existing);

    await this.repository.assign(code, statusRow.id);

    this.auditService.logEntityStatusAssigned(userId, code, statusRow.code);

    return EntityStatusMapper.buildEntityStatusDto({
      entityCode: code,
      isActive: true,
      statusGuuid: statusRow.guuid,
      statusCode: statusRow.code,
      name: statusRow.name,
      fontColor: statusRow.fontColor ?? null,
      bgColor: statusRow.bgColor ?? null,
      borderColor: statusRow.borderColor ?? null,
      isBold: statusRow.isBold ?? false,
      sortOrder: statusRow.sortOrder ?? null,
    });
  }

  async removeStatus(entityCode: string, statusGuuid: string, userId: number): Promise<void> {
    const code = EntityCodeValidator.normalize(entityCode);
    EntityCodeValidator.validate(code);

    const statusRow = await this.statusService.findByGuuid(statusGuuid);
    EntityStatusValidator.assertStatusFound(statusRow);

    const mapping = await this.repository.findMapping(code, statusRow.id);
    EntityStatusValidator.assertAssignmentExists(mapping);

    await this.repository.remove(code, statusRow.id);

    this.auditService.logEntityStatusRemoved(userId, code, statusRow.code);
  }
}
