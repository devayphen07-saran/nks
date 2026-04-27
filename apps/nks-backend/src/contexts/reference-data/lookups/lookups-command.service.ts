import { Injectable } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import { AdminLookupMapper } from './mapper/lookups.mapper';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import type { LookupValueAdminResponse } from './dto/admin-lookups.dto';
import type { CreateLookupValueDto, UpdateLookupValueDto } from './dto/admin-lookups.dto';

@Injectable()
export class LookupsCommandService {
  constructor(
    private readonly repository: LookupsRepository,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const category = await this.repository.findCodeCategoryByCode(categoryCode);
    if (!category) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    const result = await this.repository.createCodeValue(category.id, dto);
    this.auditCommand.logLookupValueCreated(userId, result.id, categoryCode);
    return result;
  }

  async updateLookupValue(
    categoryCode: string,
    guuid: string,
    dto: UpdateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const value = await this.repository.findCodeValueByGuuidAndCategory(guuid, categoryCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    const updated = await this.repository.updateCodeValue(value.numericId, dto);
    if (!updated) throw new BadRequestException(errPayload(ErrorCode.LOOKUP_UPDATE_FAILED));
    this.auditCommand.logLookupValueUpdated(userId, value.numericId, categoryCode);
    return updated;
  }

  async deleteLookupValue(categoryCode: string, guuid: string, userId: number): Promise<void> {
    const value = await this.repository.findCodeValueByGuuidAndCategory(guuid, categoryCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    await this.repository.deleteCodeValue(value.numericId);
    this.auditCommand.logLookupValueDeleted(userId, value.numericId, categoryCode);
  }
}
