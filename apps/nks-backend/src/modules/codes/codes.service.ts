import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CodesRepository } from './codes.repository';
import { RolesService } from '../roles/roles.service';
import type {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from './dto/codes-response.dto';
import { toCategoryResponse, toValueResponse } from './mapper/codes.mapper';

@Injectable()
export class CodesService {
  constructor(
    private readonly repo: CodesRepository,
    private readonly rolesService: RolesService,
  ) {}

  async getValuesByCategory(
    categoryCode: string,
    storeId?: number,
  ): Promise<CodeValueResponseDto[]> {
    const category = await this.repo.findCategory(categoryCode);
    if (!category)
      throw new NotFoundException(`Code category '${categoryCode}' not found`);

    const values = await this.repo.findValuesByCategory(category.id, storeId);
    return values.map(toValueResponse);
  }

  async getAllCategories(): Promise<CodeCategoryResponseDto[]> {
    const categories = await this.repo.findAllCategories();
    return categories.map(toCategoryResponse);
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
    if (!category)
      throw new NotFoundException(`Code category '${categoryCode}' not found`);

    // SECURITY: Validate store ownership if storeId is provided
    if (data.storeId && userId && !isSuperAdmin) {
      const isOwner = await this.rolesService.isStoreOwner(userId, data.storeId);
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not own this store. Only store owners can create codes for their stores.',
        );
      }
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
  ): Promise<CodeValueResponseDto> {
    // SECURITY: Repository guards against system code modifications
    // updateValue() only succeeds if isSystem = false
    const updated = await this.repo.updateValue(id, data);
    if (!updated)
      throw new BadRequestException(
        `Value not found or is a system value — cannot edit`,
      );
    return updated;
  }

  async deleteValue(id: number, deletedBy: number): Promise<void> {
    // SECURITY: Repository guards against system code deletion
    // softDeleteValue() only succeeds if isSystem = false
    await this.repo.softDeleteValue(id, deletedBy);
  }
}
