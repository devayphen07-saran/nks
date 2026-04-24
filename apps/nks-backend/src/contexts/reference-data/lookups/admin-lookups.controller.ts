import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';
import { LookupsService } from './lookups.service';
import type {
  LookupTypesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';
import {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  GetLookupValuesQueryDto,
} from './dto/admin-lookups.dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Admin / Lookups')
@Controller('admin/lookups')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.LOOKUP)
@ApiBearerAuth()
export class AdminLookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get()
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Lookup types retrieved successfully')
  @ApiOperation({ summary: 'Get all lookup types' })
  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.lookupsService.getAllLookupTypes();
  }

  @Get(':code')
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Lookup values retrieved successfully')
  @ApiOperation({ summary: 'Get values for a lookup type' })
  async listLookupValues(
    @Param('code') code: string,
    @Query() query: GetLookupValuesQueryDto,
  ): Promise<PaginatedResult<LookupValueAdminResponse>> {
    return this.lookupsService.listLookupValues(code, query);
  }

  @Post(':code')
  @RequireEntityPermission({
    action: PermissionActions.CREATE,
    scope: 'PLATFORM',
  })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Lookup value created successfully')
  @ApiOperation({ summary: 'Create a lookup value' })
  async createLookupValue(
    @Param('code') code: string,
    @Body() dto: CreateLookupValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<LookupValueAdminResponse> {
    return this.lookupsService.createLookupValue(code, dto, user.userId);
  }

  @Put(':code/:guuid')
  @RequireEntityPermission({
    action: PermissionActions.EDIT,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Lookup value updated successfully')
  @ApiOperation({ summary: 'Update a lookup value' })
  async updateLookupValue(
    @Param('code') code: string,
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @Body() dto: UpdateLookupValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<LookupValueAdminResponse> {
    return this.lookupsService.updateLookupValue(code, guuid, dto, user.userId);
  }

  @Delete(':code/:guuid')
  @RequireEntityPermission({
    action: PermissionActions.DELETE,
    scope: 'PLATFORM',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lookup value' })
  async deleteLookupValue(
    @Param('code') code: string,
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.lookupsService.deleteLookupValue(code, guuid, user.userId);
  }
}
