import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import {
  EntityCodes,
  PermissionActions,
} from '../../../common/constants/entity-codes.constants';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dto/requests';
import type { AuditLogResponseDto } from './dto/responses';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Admin / Audit')
@Controller('admin/audit')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.AUDIT_LOG)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Audit logs retrieved')
  @ApiOperation({ summary: 'List audit logs with filtering' })
  async listLogs(
    @Query() query: AuditListQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    return this.auditService.listLogs(query);
  }

  @Get(':auditGuuid')
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Audit log retrieved')
  @ApiOperation({ summary: 'Get a single audit log by guuid' })
  async getByGuuid(
    @Param('auditGuuid', ParseUUIDPipe) auditGuuid: string,
  ): Promise<AuditLogResponseDto> {
    return this.auditService.getByGuuid(auditGuuid);
  }
}
