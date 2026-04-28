import { Injectable, Logger } from '@nestjs/common';
import { EntityStatusRepository } from './repositories/entity-status.repository';
import { EntityStatusMapper } from './mapper/entity-status.mapper';
import { EntityCodeValidator } from './validators';
import type { EntityStatusResponse } from './dto/entity-status.dto';

@Injectable()
export class EntityStatusQueryService {
  private readonly logger = new Logger(EntityStatusQueryService.name);

  constructor(private readonly repository: EntityStatusRepository) {}

  async getStatusesForEntity(entityCode: string): Promise<EntityStatusResponse[]> {
    const code = EntityCodeValidator.normalize(entityCode);
    EntityCodeValidator.validate(code);
    const rows = await this.repository.findByEntityCode(code);
    return rows.map(EntityStatusMapper.buildEntityStatusDto);
  }
}
