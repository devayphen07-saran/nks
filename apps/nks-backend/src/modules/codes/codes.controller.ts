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
import { Public } from '../../common/decorators/public.decorator';
import { RequireEntityPermission } from '../../common/decorators/require-entity-permission.decorator';
import { EntityCodes, PermissionActions } from '../../common/constants/entity-codes.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { ApiResponse } from '../../common/utils/api-response';
import {
  UpdateCodeValueDto,
  CreateCodeCategoryDto,
  CreateCodeValueDto,
  GetCodeValuesQuerySchema,
  GetCodeValuesQueryDto,
} from './dto/codes-request.dto';
import { CodeCategoryResponseDto, CodeValueResponseDto } from './dto/codes-response.dto';

@ApiTags('Codes')
@Controller('codes')
export class CodesController {
  constructor(private readonly service: CodesService) {}

  @Get('categories')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_CATEGORY, action: PermissionActions.VIEW })
  @ApiOperation({ summary: 'List all code categories' })
  async getCategories(): Promise<ApiResponse<CodeCategoryResponseDto[]>> {
    const data = await this.service.getAllCategories();
    return ApiResponse.ok(data, 'Code categories fetched');
  }

  @Post('categories')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_CATEGORY, action: PermissionActions.CREATE })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new code category' })
  async createCategory(
    @Body() dto: CreateCodeCategoryDto,
  ): Promise<ApiResponse<CodeCategoryResponseDto>> {
    const data = await this.service.createCategory(dto);
    return ApiResponse.ok(data, 'Code category created');
  }

  @Post(':categoryCode/values')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.CREATE })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a value to a category' })
  async createValue(
    @Param('categoryCode') categoryCode: string,
    @Body() dto: CreateCodeValueDto,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.createValue(categoryCode.toUpperCase(), dto);
    return ApiResponse.ok(data, 'Code value created');
  }

  @Get(':categoryCode')
  @Public()
  @ApiOperation({
    summary: 'Get all values for a category — optionally scoped to a store',
  })
  async getValues(
    @Param('categoryCode') categoryCode: string,
    @Query(new ZodValidationPipe(GetCodeValuesQuerySchema))
    query: GetCodeValuesQueryDto,
  ): Promise<ApiResponse<CodeValueResponseDto[]>> {
    const data = await this.service.getValuesByCategory(
      categoryCode.toUpperCase(),
      query.storeId,
    );
    return ApiResponse.ok(data, 'Code values fetched');
  }

  @Put('values/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.EDIT })
  @ApiOperation({ summary: 'Edit a non-system value' })
  async updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCodeValueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.updateValue(id, dto, req.user.userId);
    return ApiResponse.ok(data, 'Code value updated');
  }

  @Delete('values/:id')
  @UseGuards(AuthGuard, RBACGuard)
  @RequireEntityPermission({ entityCode: EntityCodes.CODE_VALUE, action: PermissionActions.DELETE })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a non-system value' })
  async deleteValue(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteValue(id, req.user.userId);
  }
}
