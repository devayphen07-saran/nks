import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException, BadRequestException, ForbiddenException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import type { LookupValueAdminResponse } from './dto/admin-lookups.dto';
import type { CreateLookupValueDto, UpdateLookupValueDto } from './dto/admin-lookups.dto';

@Injectable()
export class LookupsCommandService {
  private readonly logger = new Logger(LookupsCommandService.name);

  constructor(
    private readonly repository: LookupsRepository,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async createLookupValue(
    typeCode: string,
    dto: CreateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const type = await this.repository.findLookupTypeByCode(typeCode);
    if (!type) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    if (type.hasTable) throw new ForbiddenException(errPayload(ErrorCode.LOOKUP_SYSTEM_TYPE_READONLY));
    const result = await this.repository.createLookupValue(type.id, dto);
    this.auditCommand.logLookupValueCreated(userId, result.id, typeCode);
    return result;
  }

  async updateLookupValue(
    typeCode: string,
    guuid: string,
    dto: UpdateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const type = await this.repository.findLookupTypeByCode(typeCode);
    if (!type) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    if (type.hasTable) throw new ForbiddenException(errPayload(ErrorCode.LOOKUP_SYSTEM_TYPE_READONLY));
    const value = await this.repository.findLookupValueByGuuidAndType(guuid, typeCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    const updated = await this.repository.updateLookupValue(value.numericId, dto);
    if (!updated) throw new BadRequestException(errPayload(ErrorCode.LOOKUP_UPDATE_FAILED));
    this.auditCommand.logLookupValueUpdated(userId, value.numericId, typeCode);
    return updated;
  }

  async deleteLookupValue(typeCode: string, guuid: string, userId: number): Promise<void> {
    const type = await this.repository.findLookupTypeByCode(typeCode);
    if (!type) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    if (type.hasTable) throw new ForbiddenException(errPayload(ErrorCode.LOOKUP_SYSTEM_TYPE_READONLY));
    const value = await this.repository.findLookupValueByGuuidAndType(guuid, typeCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    await this.repository.deleteLookupValue(value.numericId);
    this.auditCommand.logLookupValueDeleted(userId, value.numericId, typeCode);
  }
}
