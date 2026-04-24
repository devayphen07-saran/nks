import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CodesService } from './codes.service';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import {
  EntityCodes,
  PermissionActions,
} from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';
import {
  CreateCodeCategoryDto,
  GetCodeCategoriesQueryDto,
} from './dto/codes-request.dto';
import type { CodeCategoryResponseDto } from './dto/codes-response.dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

@ApiTags('Admin / Codes')
@Controller('admin/codes')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.CODE_CATEGORY)
@ApiBearerAuth()
export class AdminCodesController {
  constructor(private readonly service: CodesService) {}

  @Get('categories')
  @RequireEntityPermission({
    action: PermissionActions.VIEW,
    scope: 'PLATFORM',
  })
  @ResponseMessage('Code categories fetched')
  @ApiOperation({ summary: 'List all code categories' })
  async listCategories(
    @Query() query: GetCodeCategoriesQueryDto,
  ): Promise<PaginatedResult<CodeCategoryResponseDto>> {
    return this.service.listCategories({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      isActive: query.isActive,
    });
  }

  @Post('categories')
  @RequireEntityPermission({
    action: PermissionActions.CREATE,
    scope: 'PLATFORM',
  })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Code category created')
  @ApiOperation({ summary: 'Create a new code category' })
  async createCategory(
    @Body() dto: CreateCodeCategoryDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CodeCategoryResponseDto> {
    return this.service.createCategory(dto, user.userId);
  }
}
