import { Injectable } from '@nestjs/common';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { StatusQueryService } from '../status/status-query.service';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { EntityStatusMapper } from './mapper/entity-status.mapper';
import { EntityCodeValidator, EntityStatusValidator } from './validators';
import type { AssignStatusDto, EntityStatusResponse } from './dto/entity-status.dto';

@Injectable()
export class EntityStatusCommandService {
  constructor(
    private readonly repository:   EntityStatusRepository,
    private readonly statusQuery:  StatusQueryService,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async assignStatus(entityCode: string, dto: AssignStatusDto, userId: number): Promise<EntityStatusResponse> {
    const code = EntityCodeValidator.normalize(entityCode);
    EntityCodeValidator.validate(code);

    const statusRow = await this.statusQuery.findByGuuid(dto.statusGuuid);
    EntityStatusValidator.assertStatusFound(statusRow);

    const existing = await this.repository.findMapping(code, statusRow.id);
    EntityStatusValidator.assertNotAlreadyAssigned(existing);

    await this.repository.assign(code, statusRow.id);
    this.auditCommand.logEntityStatusAssigned(userId, code, statusRow.code);

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

    const statusRow = await this.statusQuery.findByGuuid(statusGuuid);
    EntityStatusValidator.assertStatusFound(statusRow);

    const mapping = await this.repository.findMapping(code, statusRow.id);
    EntityStatusValidator.assertAssignmentExists(mapping);

    await this.repository.remove(code, statusRow.id);
    this.auditCommand.logEntityStatusRemoved(userId, code, statusRow.code);
  }
}
