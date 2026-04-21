import { Injectable } from '@nestjs/common';
import { CodesRepository } from './repositories/codes.repository';
import { RolesService } from '../../iam/roles/roles.service';
import { CodesValidator } from './validators';
import type {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from './dto/codes-response.dto';
import { CodesMapper } from './mapper/codes.mapper';

@Injectable()
export class CodesService {
  constructor(
    private readonly repo: CodesRepository,
    private readonly rolesService: RolesService,
  ) {}

  async listValues(
    categoryCode: string,
    opts: { page: number; pageSize: number; storeId?: number; search?: string },
  ): Promise<{ rows: CodeValueResponseDto[]; total: number }> {
    const category = await this.repo.findCategory(categoryCode);
    CodesValidator.assertCategoryFound(category);

    const { rows, total } = await this.repo.findValuesByCategory(category.id, opts);
    return { rows: rows.map(CodesMapper.toValue), total };
  }

  async listCategories(opts: {
    page:    number;
    pageSize: number;
    search?: string;
  }): Promise<{ rows: CodeCategoryResponseDto[]; total: number }> {
    const { rows, total } = await this.repo.findAllCategories(opts);
    return { rows: rows.map(CodesMapper.toCategory), total };
  }

  async createCategory(data: {
    code: string;
    name: string;
    description?: string;
  }): Promise<CodeCategoryResponseDto> {
    return this.repo.createCategory({
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      isSystem: false,
    });
  }

  async createValue(
    categoryCode: string,
    data: {
      code: string;
      label: string;
      description?: string;
      sortOrder?: number;
      storeId?: number;
    },
    userId?: number,
    isSuperAdmin: boolean = false,
  ): Promise<CodeValueResponseDto> {
    const category = await this.repo.findCategory(categoryCode);
    CodesValidator.assertCategoryFound(category);

    // SECURITY: Validate store ownership if storeId is provided
    if (data.storeId && userId && !isSuperAdmin) {
      const isOwner = await this.rolesService.isStoreOwner(userId, data.storeId);
      CodesValidator.assertStoreOwnership(isOwner);
    }

    return this.repo.createValue({
      categoryFk: category.id,
      code: data.code.toUpperCase(),
      label: data.label,
      description: data.description,
      sortOrder: data.sortOrder,
      storeFk: data.storeId ?? null,
      isSystem: false,
    });
  }

  async updateValue(
    id: number,
    data: { label?: string; description?: string; sortOrder?: number },
    userId: number,
  ): Promise<CodeValueResponseDto> {
    const existing = await this.repo.findValueById(id);
    CodesValidator.assertValueFound(existing);
    CodesValidator.assertNotSystem(existing.isSystem);

    // SECURITY: If this is a store-scoped value, caller must own that store
    if (existing.storeFk) {
      const isOwner = await this.rolesService.isStoreOwner(userId, existing.storeFk);
      CodesValidator.assertStoreOwnership(isOwner);
    }

    const updated = await this.repo.updateValue(id, data);
    CodesValidator.assertUpdateSucceeded(updated);
    return updated;
  }

  async deleteValue(id: number, deletedBy: number): Promise<void> {
    const deleted = await this.repo.softDeleteValue(id, deletedBy);
    CodesValidator.assertValueFound(deleted);
  }
}
