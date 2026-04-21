import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CodesService } from './codes.service';
import { AuditService } from '../../compliance/audit/audit.service';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import type { AuthenticatedRequest } from '../../../common/guards/auth.guard';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { ApiResponse } from '../../../common/utils/api-response';
import {
  UpdateCodeValueDto,
  CreateCodeCategoryDto,
  CreateCodeValueDto,
  GetCodeCategoriesQueryDto,
  GetCodeValuesQueryDto,
} from './dto/codes-request.dto';
import { CodeCategoryResponseDto, CodeValueResponseDto } from './dto/codes-response.dto';

@ApiTags('Codes')
@Controller('codes')
export class CodesController {
  constructor(
    private readonly service: CodesService,
    private readonly auditService: AuditService,
  ) {}

  @Get('categories')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_CATEGORY, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'List all code categories' })
  async listCategories(
    @Query() query: GetCodeCategoriesQueryDto,
  ): Promise<ApiResponse<{ items: CodeCategoryResponseDto[] }>> {
    const { rows, total } = await this.service.listCategories(query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Code categories fetched' });
  }

  @Post('categories')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_CATEGORY, action: PermissionActions.CREATE })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new code category' })
  async createCategory(
    @Body() dto: CreateCodeCategoryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeCategoryResponseDto>> {
    const data = await this.service.createCategory(dto);
    this.auditService.logCodeCategoryCreated(req.user.userId, data.id, data.code);
    return ApiResponse.ok(data, 'Code category created');
  }

  @Post(':categoryCode/values')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.CREATE })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a value to a category' })
  async createValue(
    @Param('categoryCode') categoryCode: string,
    @Body() dto: CreateCodeValueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.createValue(categoryCode.toUpperCase(), dto);
    this.auditService.logCodeValueCreated(req.user.userId, data.id, data.code, categoryCode.toUpperCase());
    return ApiResponse.ok(data, 'Code value created');
  }

  @Get(':categoryCode')
  @Public()
  @ApiOperation({
    summary: 'Get all values for a category — optionally scoped to a store',
  })
  async listValues(
    @Param('categoryCode') categoryCode: string,
    @Query() query: GetCodeValuesQueryDto,
  ): Promise<ApiResponse<{ items: CodeValueResponseDto[] }>> {
    const { rows, total } = await this.service.listValues(categoryCode.toUpperCase(), query);
    return ApiResponse.paginated({ items: rows, page: query.page, pageSize: query.pageSize, total, message: 'Code values fetched' });
  }

  @Put('values/:id')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.EDIT })
  @ApiOperation({ summary: 'Edit a non-system value' })
  async updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCodeValueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.updateValue(id, dto, req.user.userId);
    this.auditService.logCodeValueUpdated(req.user.userId, id, { ...dto });
    return ApiResponse.ok(data, 'Code value updated');
  }

  @Delete('values/:id')
  @UseGuards(RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.DELETE })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a non-system value' })
  async deleteValue(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteValue(id, req.user.userId);
    this.auditService.logCodeValueDeleted(req.user.userId, id);
  }
}
