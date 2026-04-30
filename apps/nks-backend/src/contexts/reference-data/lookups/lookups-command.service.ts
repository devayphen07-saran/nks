import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { LookupsValidator } from './lookups.validator';
import type { LookupValueAdminResponse } from './dto/admin-lookups.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
} from './dto/admin-lookups.dto';

/**
 * LookupsCommandService
 *
 * Manages lookup value lifecycle (create, update, delete).
 * All methods require platform-level LOOKUP.CREATE/EDIT/DELETE permissions
 * (checked by @RequirePermission decorator at controller level).
 *
 * Authorization Contract:
 *   - Caller must have LOOKUP.CREATE permission to call createLookupValue()
 *   - Caller must have LOOKUP.EDIT permission to call updateLookupValue()
 *   - Caller must have LOOKUP.DELETE permission to call deleteLookupValue()
 *
 * Business Rule Validation:
 *   - Lookup types backed by system tables (hasTable=true) are immutable
 *   - System lookup values (isSystem=true) cannot be modified
 *
 * Audit Trail:
 *   - All operations tracked via AuditCommandService
 *   - userId parameter identifies who performed the operation
 */
@Injectable()
export class LookupsCommandService {
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
    LookupsValidator.assertLookupTypeValid(type);
    const result = await this.repository.createLookupValue(
      type.id,
      dto,
      userId,
    );
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
    LookupsValidator.assertLookupTypeValid(type);
    const value = await this.repository.findLookupValueByGuuidAndType(
      guuid,
      typeCode,
    );
    if (!value)
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    LookupsValidator.assertLookupValueEditable(value);
    const updated = await this.repository.updateLookupValue(
      value.numericId,
      dto,
      userId,
    );
    if (!updated)
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    this.auditCommand.logLookupValueUpdated(userId, value.numericId, typeCode);
    return updated;
  }

  async deleteLookupValue(
    typeCode: string,
    guuid: string,
    userId: number,
  ): Promise<void> {
    const type = await this.repository.findLookupTypeByCode(typeCode);
    LookupsValidator.assertLookupTypeValid(type);
    const value = await this.repository.findLookupValueByGuuidAndType(
      guuid,
      typeCode,
    );
    if (!value)
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    LookupsValidator.assertLookupValueEditable(value);
    await this.repository.deleteLookupValue(value.numericId, userId);
    this.auditCommand.logLookupValueDeleted(userId, value.numericId, typeCode);
  }
}
