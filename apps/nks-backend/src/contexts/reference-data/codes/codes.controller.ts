import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CodesService } from './codes.service';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { CreateCodeValueDto, UpdateCodeValueDto, GetCodeValuesQueryDto } from './dto/codes-request.dto';
import type { CodeValueResponseDto } from './dto/codes-response.dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Codes')
@Controller('codes')
@EntityResource(EntityCodes.CODE_VALUE)
export class CodesController {
  constructor(private readonly service: CodesService) {}

  @Get(':categoryCode')
  @Public()
  @ResponseMessage('Code values fetched')
  @ApiOperation({
    summary: 'Get all values for a category — optionally scoped to a store',
    description: 'Query Params: page, pageSize (max 200), search (min 2 chars), sortBy (code|label|sortOrder|createdAt), sortOrder (asc|desc), isActive (boolean), storeId (optional)',
  })
  async listValues(
    @Param('categoryCode') categoryCode: string,
    @Query() query: GetCodeValuesQueryDto,
  ): Promise<PaginatedResult<CodeValueResponseDto>> {
    return this.service.listValues(categoryCode.toUpperCase(), {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      storeGuuid: query.storeGuuid,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      isActive: query.isActive,
    });
  }

  @Post(':categoryCode/values')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ action: PermissionActions.CREATE })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Code value created')
  @ApiOperation({ summary: 'Add a value to a category' })
  async createValue(
    @Param('categoryCode') categoryCode: string,
    @Body() dto: CreateCodeValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CodeValueResponseDto> {
    return this.service.createValue(categoryCode.toUpperCase(), dto, user);
  }

  @Put('values/:guuid')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ action: PermissionActions.EDIT })
  @ResponseMessage('Code value updated')
  @ApiOperation({ summary: 'Edit a non-system value' })
  async updateValue(
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @Body() dto: UpdateCodeValueDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CodeValueResponseDto> {
    return this.service.updateValue(guuid, dto, user);
  }

  @Delete('values/:guuid')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ action: PermissionActions.DELETE })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a non-system value' })
  async deleteValue(
    @Param('guuid', ParseUUIDPipe) guuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.service.deleteValue(guuid, user);
  }
}
