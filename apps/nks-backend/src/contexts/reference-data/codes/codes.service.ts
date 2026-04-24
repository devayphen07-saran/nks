import { Injectable } from '@nestjs/common';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '../../../common/exceptions';
import { CodesRepository } from './repositories/codes.repository';
import { AuditService } from '../../compliance/audit/audit.service';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import { SystemRoleCodes } from '../../../common/constants/system-role-codes.constant';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from './dto/codes-response.dto';
import { CodesMapper } from './mapper/codes.mapper';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';

@Injectable()
export class CodesService {
  constructor(
    private readonly repo: CodesRepository,
    private readonly auditService: AuditService,
  ) {}

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
    if (!category)
      throw new NotFoundException(errPayload(ErrorCode.COD_CATEGORY_NOT_FOUND));

    const storeFk = opts.storeGuuid
      ? await this.repo.findStoreIdByGuuid(opts.storeGuuid)
      : undefined;

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

  async createCategory(
    data: { code: string; name: string; description?: string },
    userId: number,
  ): Promise<CodeCategoryResponseDto> {
    const result = await this.repo.createCategory({
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      isSystem: false,
    });
    this.auditService.logCodeCategoryCreated(userId, result.id, result.code);
    return result;
  }

  async createValue(
    categoryCode: string,
    data: {
      code: string;
      label: string;
      description?: string;
      sortOrder?: number;
      storeGuuid?: string;
    },
    user: SessionUser,
  ): Promise<CodeValueResponseDto> {
    const category = await this.repo.findCategory(categoryCode);
    if (!category)
      throw new NotFoundException(errPayload(ErrorCode.COD_CATEGORY_NOT_FOUND));

    const storeFk = data.storeGuuid
      ? await this.repo.findStoreIdByGuuid(data.storeGuuid)
      : null;

    if (storeFk !== null && !user.isSuperAdmin) {
      const isOwner = user.roles.some(
        (r) =>
          r.roleCode === SystemRoleCodes.STORE_OWNER &&
          r.storeId === storeFk,
      );
      if (!isOwner)
        throw new ForbiddenException(
          errPayload(ErrorCode.COD_STORE_OWNERSHIP_REQUIRED),
        );
    }

    const result = await this.repo.createValue({
      categoryFk: category.id,
      code: data.code.toUpperCase(),
      label: data.label,
      description: data.description,
      sortOrder: data.sortOrder,
      storeFk,
      isSystem: false,
    });
    this.auditService.logCodeValueCreated(
      user.userId,
      result.id,
      result.code,
      categoryCode.toUpperCase(),
    );
    const created = await this.repo.findValueByIdWithStore(result.id);
    if (!created) throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    return CodesMapper.buildValueDto(created);
  }

  async updateValue(
    guuid: string,
    data: { label?: string; description?: string; sortOrder?: number },
    user: SessionUser,
  ): Promise<CodeValueResponseDto> {
    const existing = await this.repo.findValueByGuuid(guuid);
    if (!existing)
      throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    if (existing.isSystem)
      throw new ForbiddenException(errPayload(ErrorCode.COD_SYSTEM_IMMUTABLE));

    if (existing.storeFk && !user.isSuperAdmin) {
      const isOwner = user.roles.some(
        (r) =>
          r.roleCode === SystemRoleCodes.STORE_OWNER &&
          r.storeId === existing.storeFk,
      );
      if (!isOwner)
        throw new ForbiddenException(
          errPayload(ErrorCode.COD_STORE_OWNERSHIP_REQUIRED),
        );
    }

    const updated = await this.repo.updateValue(existing.id, data);
    if (!updated)
      throw new BadRequestException(errPayload(ErrorCode.COD_UPDATE_FAILED));
    this.auditService.logCodeValueUpdated(user.userId, existing.id, { ...data });
    const withStore = await this.repo.findValueByIdWithStore(existing.id);
    if (!withStore) throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    return CodesMapper.buildValueDto(withStore);
  }

  async deleteValue(guuid: string, user: SessionUser): Promise<void> {
    const existing = await this.repo.findValueByGuuid(guuid);
    if (!existing)
      throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    if (existing.isSystem)
      throw new ForbiddenException(errPayload(ErrorCode.COD_SYSTEM_IMMUTABLE));

    if (existing.storeFk && !user.isSuperAdmin) {
      const isOwner = user.roles.some(
        (r) =>
          r.roleCode === SystemRoleCodes.STORE_OWNER &&
          r.storeId === existing.storeFk,
      );
      if (!isOwner)
        throw new ForbiddenException(
          errPayload(ErrorCode.COD_STORE_OWNERSHIP_REQUIRED),
        );
    }

    const deleted = await this.repo.softDeleteValue(existing.id, user.userId);
    if (!deleted)
      throw new NotFoundException(errPayload(ErrorCode.COD_VALUE_NOT_FOUND));
    this.auditService.logCodeValueDeleted(user.userId, existing.id);
  }
}
