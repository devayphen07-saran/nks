import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuditService } from './audit.service';
import { AuditListQueryDto } from './dto/requests';
import type { AuditLogResponseDto } from './dto/responses';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(RBACGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit
   * Retrieve audit logs with optional filtering and pagination.
   * Restricted to SUPER_ADMIN only.
   */
  @Get()
  @RequireEntityPermission({ entityCode: EntityCodes.AUDIT_LOG, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'List audit logs with filtering' })
  async listLogs(
    @Query() query: AuditListQueryDto,
  ): Promise<ApiResponse<{ items: AuditLogResponseDto[] }>> {
    const { rows, total } = await this.auditService.listLogs(query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Audit logs retrieved' });
  }

  /**
   * GET /audit/:id
   * Get a single audit log entry by ID.
   * Restricted to SUPER_ADMIN only.
   */
  @Get(':id')
  @RequireEntityPermission({ entityCode: EntityCodes.AUDIT_LOG, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'Get a single audit log by ID' })
  async getById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<AuditLogResponseDto>> {
    const log = await this.auditService.getById(id);
    return ApiResponse.ok(log, 'Audit log retrieved');
  }
}
