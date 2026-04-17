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
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { ApiResponse } from '../../common/utils/api-response';
import {
  UpdateCodeValueDto,
  CreateCodeCategoryDto,
  CreateCodeCategorySchema,
  CreateCodeValueDto,
  CreateCodeValueSchema,
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
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all code categories (SUPER_ADMIN only)' })
  async getCategories(): Promise<ApiResponse<CodeCategoryResponseDto[]>> {
    const data = await this.service.getAllCategories();
    return ApiResponse.ok(data, 'Code categories fetched');
  }

  @Post('categories')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new code category (SUPER_ADMIN only)' })
  async createCategory(
    @Body(new ZodValidationPipe(CreateCodeCategorySchema)) dto: CreateCodeCategoryDto,
  ): Promise<ApiResponse<CodeCategoryResponseDto>> {
    const data = await this.service.createCategory(dto);
    return ApiResponse.ok(data, 'Code category created');
  }

  @Post(':categoryCode/values')
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a value to a category (SUPER_ADMIN only)' })
  async createValue(
    @Param('categoryCode') categoryCode: string,
    @Body(new ZodValidationPipe(CreateCodeValueSchema)) dto: CreateCodeValueDto,
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
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Edit a non-system value (SUPER_ADMIN only)' })
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
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a non-system value (SUPER_ADMIN only)' })
  async deleteValue(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteValue(id, req.user.userId);
  }
}
