import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiResponse } from '../../../common/utils/api-response';
import { Public } from '../../../common/decorators/public.decorator';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';
import { AuditService } from '../../compliance/audit/audit.service';
import { LookupsService } from './lookups.service';
import type {
  LookupTypesListResponse,
  LookupValuesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';
import {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  GetLookupValuesQueryDto,
} from './dto/admin-lookups.dto';

@ApiTags('Lookups')
@Controller('lookups')
export class LookupsController {
  constructor(
    private readonly lookupsService: LookupsService,
    private readonly auditService: AuditService,
  ) {}

  // ── Admin routes registered before :code to avoid shadowing ────────────────

  /**
   * GET /lookups/admin
   * All code-based lookup categories with value counts.
   */
  @Get('admin')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all lookup types' })
  async getAllLookupTypes(): Promise<ApiResponse<LookupTypesListResponse>> {
    const data = await this.lookupsService.getAllLookupTypes();
    return ApiResponse.ok(data, 'Lookup types retrieved successfully');
  }

  /**
   * GET /lookups/admin/:code
   * Values list for a selected lookup type (paginated, admin only).
   */
  @Get('admin/:code')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.VIEW })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get values for a lookup type' })
  async listLookupValues(
    @Param('code') code: string,
    @Query() query: GetLookupValuesQueryDto,
  ): Promise<ApiResponse<{ items: LookupValuesListResponse }>> {
    const { rows, total } = await this.lookupsService.listLookupValues(code, query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Lookup values retrieved successfully' });
  }

  /**
   * POST /lookups/admin/:code
   * Add a new value to a lookup type.
   */
  @Post('admin/:code')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.CREATE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lookup value' })
  async createLookupValue(
    @Param('code') code: string,
    @Body() dto: CreateLookupValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<LookupValueAdminResponse>> {
    const data = await this.lookupsService.createLookupValue(code, dto);
    this.auditService.logLookupValueCreated(user.userId, data.id, code);
    return ApiResponse.ok(data, 'Lookup value created successfully');
  }

  /**
   * PUT /lookups/admin/:code/:id
   * Update an existing lookup value.
   */
  @Put('admin/:code/:id')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.EDIT })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a lookup value' })
  async updateLookupValue(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLookupValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<LookupValueAdminResponse>> {
    const data = await this.lookupsService.updateLookupValue(code, id, dto);
    this.auditService.logLookupValueUpdated(user.userId, id, code);
    return ApiResponse.ok(data, 'Lookup value updated successfully');
  }

  /**
   * DELETE /lookups/admin/:code/:id
   * Remove a lookup value.
   */
  @Delete('admin/:code/:id')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.LOOKUP, action: PermissionActions.DELETE })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lookup value' })
  async deleteLookupValue(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.lookupsService.deleteLookupValue(code, id);
    this.auditService.logLookupValueDeleted(user.userId, id, code);
  }

  // ── Public: single generic endpoint (replaces 9 individual endpoints) ────────

  /**
   * GET /lookups/:code
   * Public endpoint for all whitelisted lookup types.
   *
   * Valid codes: salutations | countries | address-types | communication-types |
   *              designations | store-legal-types | store-categories | currencies | volumes
   *
   * Returns 404 for any code not in the whitelist.
   */
  @Get(':code')
  @Public()
  @ApiOperation({ summary: 'Get a public lookup list by code' })
  async getLookup(
    @Param('code') code: string,
  ): Promise<ApiResponse<unknown[]>> {
    const data = await this.lookupsService.getPublicLookup(code);
    return ApiResponse.ok(data, `${code} retrieved successfully`);
  }
}
