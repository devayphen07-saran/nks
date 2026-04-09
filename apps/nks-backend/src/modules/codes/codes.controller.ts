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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CodesService } from './codes.service';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { ApiResponse } from '../../common/utils/api-response';
import {
  CreateCodeCategoryDto,
  CreateCodeValueDto,
  UpdateCodeValueDto,
  GetCodeValuesQuerySchema,
  GetCodeValuesQueryDto,
} from './dto/codes-request.dto';
import {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from './dto/codes-response.dto';

@ApiTags('Codes')
@Controller('codes')
export class CodesController {
  constructor(private readonly service: CodesService) {}

  // ── Public read endpoints ─────────────────────────────────────────────────

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List all code categories' })
  async getCategories(): Promise<ApiResponse<CodeCategoryResponseDto[]>> {
    const data = await this.service.getAllCategories();
    return ApiResponse.ok(data, 'Categories fetched');
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

  // ── Admin write endpoints ─────────────────────────────────────────────────

  @Post('categories')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new code category (admin only)' })
  async createCategory(
    @Body() dto: CreateCodeCategoryDto,
  ): Promise<ApiResponse<CodeCategoryResponseDto>> {
    const data = await this.service.createCategory(dto);
    return ApiResponse.ok(data, 'Category created');
  }

  @Post(':categoryCode/values')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a value to a category' })
  async createValue(
    @Param('categoryCode') categoryCode: string,
    @Body() dto: CreateCodeValueDto,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.createValue(
      categoryCode.toUpperCase(),
      dto,
    );
    return ApiResponse.ok(data, 'Code value created');
  }

  @Put('values/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a non-system value' })
  async updateValue(
    @Param('id') id: string,
    @Body() dto: UpdateCodeValueDto,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.updateValue(Number(id), dto);
    return ApiResponse.ok(data, 'Code value updated');
  }

  @Delete('values/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a non-system value' })
  async deleteValue(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.deleteValue(
      Number(id),
      req.user.userId,
    );
    return ApiResponse.ok(null, 'Code value deleted');
  }
}
