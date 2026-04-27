import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../common/exceptions';
import { LookupsRepository } from '../lookups/repositories/lookups.repository';
import { CodesMapper } from './mapper/codes.mapper';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type { CodeCategoryResponseDto, CodeValueResponseDto } from './dto/codes-response.dto';

@Injectable()
export class CodesQueryService {
  constructor(private readonly repo: LookupsRepository) {}

  async listValues(
    categoryCode: string,
    opts: {
      page: number;
      pageSize: number;
      storeGuuid?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      isActive?: boolean;
    },
  ): Promise<PaginatedResult<CodeValueResponseDto>> {
    const category = await this.repo.findCategory(categoryCode);
    if (!category) throw new NotFoundException(errPayload(ErrorCode.COD_CATEGORY_NOT_FOUND));

    const storeFk = opts.storeGuuid ? await this.repo.findStoreIdByGuuid(opts.storeGuuid) : undefined;

    const { rows, total } = await this.repo.findValuesByCategory(category.id, {
      page: opts.page,
      pageSize: opts.pageSize,
      search: opts.search,
      sortBy: opts.sortBy,
      sortOrder: opts.sortOrder,
      isActive: opts.isActive,
      storeId: storeFk ?? undefined,
    });
    return paginated({ items: rows.map(CodesMapper.buildValueDto), page: opts.page, pageSize: opts.pageSize, total });
  }

  async listCategories(opts: {
    page: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<PaginatedResult<CodeCategoryResponseDto>> {
    const { rows, total } = await this.repo.findAllCategories(opts);
    return paginated({ items: rows.map(CodesMapper.buildCategoryDto), page: opts.page, pageSize: opts.pageSize, total });
  }
}
