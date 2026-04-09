import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EntityStatusRepository } from './entity-status.repository';
import { StatusRepository } from '../status/status.repository';
import type { AssignStatusDto, EntityStatusResponse } from './dto/entity-status.dto';
import { toEntityStatusResponse } from './mapper/entity-status.mapper';
import { EntityCodeValidator } from './validators';

@Injectable()
export class EntityStatusService {
  constructor(
    private readonly repository:       EntityStatusRepository,
    private readonly statusRepository: StatusRepository,
  ) {}

  async getStatusesForEntity(entityCode: string): Promise<EntityStatusResponse[]> {
    const code = EntityCodeValidator.normalize(entityCode);

    // SECURITY: Validate entity code format using EntityCodeValidator
    EntityCodeValidator.validate(code);

    const rows = await this.repository.findByEntityCode(code);
    return rows.map(toEntityStatusResponse);
  }

  async assignStatus(entityCode: string, dto: AssignStatusDto): Promise<EntityStatusResponse[]> {
    const code = EntityCodeValidator.normalize(entityCode);

    // SECURITY: Validate entity code format using EntityCodeValidator
    EntityCodeValidator.validate(code);

    // Resolve guuid → row
    const statusRow = await this.statusRepository.findByGuuid(dto.statusGuuid);
    if (!statusRow) {
      throw new NotFoundException(`Status '${dto.statusGuuid}' not found`);
    }

    // Check duplicate
    const existing = await this.repository.findMapping(code, statusRow.id);
    if (existing?.isActive) {
      throw new ConflictException(
        `Status '${statusRow.code}' is already assigned to entity '${entityCode}'`,
      );
    }

    await this.repository.assign(code, statusRow.id);
    return this.getStatusesForEntity(code);
  }

  async removeStatus(entityCode: string, statusGuuid: string): Promise<void> {
    const code = EntityCodeValidator.normalize(entityCode);

    // SECURITY: Validate entity code format using EntityCodeValidator
    EntityCodeValidator.validate(code);

    const statusRow = await this.statusRepository.findByGuuid(statusGuuid);
    if (!statusRow) {
      throw new NotFoundException(`Status '${statusGuuid}' not found`);
    }

    const mapping = await this.repository.findMapping(code, statusRow.id);
    if (!mapping) {
      throw new NotFoundException(
        `Status '${statusRow.code}' is not assigned to entity '${entityCode}'`,
      );
    }

    await this.repository.remove(code, statusRow.id);
  }
}
